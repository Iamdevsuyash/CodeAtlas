"""Code-intelligence agent: a ReAct loop over a repository's indexed code."""

from app.agent.loop import AgentResult, run_agent

__all__ = ["run_agent", "AgentResult"]
