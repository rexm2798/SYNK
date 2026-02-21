from __future__ import annotations

import os
from typing import List

from backend.agents import finance, logistics, procurement, production, quality
from backend.models import AgentResult, NegotiationResponse, NegotiationRound, RushOrderRequest


class NegotiationOrchestrator:
    def __init__(self, data, max_rounds: int = 3) -> None:
        self.data = data
        self.max_rounds = max_rounds

    def run(self, order: RushOrderRequest) -> NegotiationResponse:
        shared_memory = {"order": order.model_dump(), "round": 0}
        rounds: List[NegotiationRound] = []

        for i in range(1, self.max_rounds + 1):
            shared_memory["round"] = i

            prod = production.evaluate(order, shared_memory, self.data)
            proc = procurement.evaluate(order, shared_memory, self.data)
            logi = logistics.evaluate(order, shared_memory, self.data)
            qa = quality.evaluate(order, shared_memory, self.data)
            fin = finance.evaluate(order, shared_memory, self.data)

            agent_results = [prod, proc, logi, qa, fin]
            consensus = self._consensus(agent_results)

            rounds.append(
                NegotiationRound(
                    round=i,
                    agent_results=agent_results,
                    shared_memory=shared_memory.copy(),
                    consensus=consensus,
                )
            )

            if consensus:
                break

            self._apply_policy_adjustments(order, agent_results)

        final_margin = float(shared_memory["finance"]["margin_pct"])
        decision = "approve" if rounds[-1].consensus else "conditional/reject"
        risk = self._risk_score(rounds[-1].consensus, final_margin, order.margin_floor)

        response = NegotiationResponse(
            rounds=rounds,
            final_margin=final_margin,
            risk_score=risk,
            decision=decision,
            summary={
                "rounds_ran": len(rounds),
                "delay_days": shared_memory.get("production", {}).get("delay_days", 0),
                "material_delta": shared_memory.get("procurement", {}).get("extra_material_cost", 0),
                "shipping_mode": shared_memory.get("logistics", {}).get("shipping_mode", "standard"),
            },
        )
        response.llm_summary = self._llm_summary(response)
        return response

    def _consensus(self, results: List[AgentResult]) -> bool:
        return all(r.status != "No" for r in results)

    def _apply_policy_adjustments(self, order: RushOrderRequest, results: List[AgentResult]) -> None:
        names = {r.agent: r for r in results}
        if names["production"].status == "No" or names["quality"].status == "No":
            order.deadline_days = min(order.deadline_days + 1, 30)
        if names["finance"].status == "No":
            order.price += 10

    def _risk_score(self, consensus: bool, margin: float, floor: float) -> str:
        if not consensus:
            return "High"
        if margin < floor + 3:
            return "Medium"
        return "Low"

    def _llm_summary(self, response: NegotiationResponse) -> str | None:
        if not os.getenv("GROQ_API_KEY"):
            return None

        try:
            from groq import Groq
        except Exception:
            return None

        client = Groq()
        prompt = (
            "Summarize this rush-order negotiation in 4 bullets with decision rationale.\n"
            f"Decision: {response.decision}, Final margin: {response.final_margin}%, Risk: {response.risk_score}.\n"
            f"Summary: {response.summary}"
        )
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_completion_tokens=512,
            top_p=1,
            reasoning_effort="medium",
            stream=False,
        )
        return completion.choices[0].message.content
