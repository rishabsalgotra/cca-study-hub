"""Measuring an agent harness: run every task k times, report pass@k AND pass^k."""
from math import comb
from statistics import mean


def pass_at_k(n: int, c: int, k: int) -> float:
    """P(at least one of k attempts succeeds), from n trials with c successes."""
    if n - c < k:
        return 1.0
    return 1 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """P(ALL k attempts succeed): the reliability number users actually feel."""
    return comb(c, k) / comb(n, k)


def evaluate(tasks: list[dict], run_agent, grade, trials: int = 5, k: int = 3) -> dict:
    per_task = []
    for task in tasks:
        successes = sum(bool(grade(task, run_agent(task["prompt"]))) for _ in range(trials))
        per_task.append({"id": task["id"], "successes": successes})
    return {
        f"pass@{k}": mean(pass_at_k(trials, t["successes"], k) for t in per_task),
        f"pass^{k}": mean(pass_hat_k(trials, t["successes"], k) for t in per_task),
        "per_task": per_task,
    }
