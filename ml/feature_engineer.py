# ml/feature_engineer.py

from dataclasses import dataclass, field
from typing import Dict, Set, List
import numpy as np
import pandas as pd


@dataclass
class BehaviorFeatureEngineer:
    global_mean_amount: float = 0.0
    global_std_amount: float = 1.0
    global_mean_step: float = 0.0
    global_std_step: float = 1.0
    global_max_tx_count: int = 1
    sender_stats: Dict[str, dict] = field(default_factory=dict)
    sender_dest_map: Dict[str, Set[str]] = field(default_factory=dict)

    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        data = df.copy()

        required = [
            "step", "type", "amount", "nameOrig", "oldbalanceOrg",
            "newbalanceOrig", "nameDest", "oldbalanceDest", "newbalanceDest"
        ]
        for col in required:
            if col not in data.columns:
                # keep code safe if a column is missing in a later test
                data[col] = 0 if col not in ["type", "nameOrig", "nameDest"] else "UNKNOWN"

        # Optional PDF-style fields for later use
        for col in ["device_mismatch_flag", "location_mismatch_flag", "failed_attempts_count"]:
            if col not in data.columns:
                data[col] = 0

        data["step"] = pd.to_numeric(data["step"], errors="coerce").fillna(0)
        data["amount"] = pd.to_numeric(data["amount"], errors="coerce").fillna(0)
        data["oldbalanceOrg"] = pd.to_numeric(data["oldbalanceOrg"], errors="coerce").fillna(0)
        data["newbalanceOrig"] = pd.to_numeric(data["newbalanceOrig"], errors="coerce").fillna(0)
        data["oldbalanceDest"] = pd.to_numeric(data["oldbalanceDest"], errors="coerce").fillna(0)
        data["newbalanceDest"] = pd.to_numeric(data["newbalanceDest"], errors="coerce").fillna(0)

        return data

    def fit(self, df: pd.DataFrame):
        data = self._clean(df).sort_values(["nameOrig", "step"]).copy()

        self.global_mean_amount = float(data["amount"].mean())
        self.global_std_amount = float(data["amount"].std() or 1.0)
        self.global_mean_step = float(data["step"].mean())
        self.global_std_step = float(data["step"].std() or 1.0)

        self.sender_stats = {}
        self.sender_dest_map = {}

        counts = []
        for sender, g in data.groupby("nameOrig", sort=False):
            sender_key = str(sender)
            tx_count = int(len(g))
            self.sender_stats[sender_key] = {
                "avg_amount": float(g["amount"].mean()),
                "std_amount": float(g["amount"].std() or 1.0),
                "tx_count": tx_count,
                "avg_step": float(g["step"].mean()),
                "std_step": float(g["step"].std() or 1.0),
            }
            self.sender_dest_map[sender_key] = set(g["nameDest"].astype(str).tolist())
            counts.append(tx_count)

        self.global_max_tx_count = max(counts) if counts else 1
        return self

    def _default_sender_stats(self):
        return {
            "avg_amount": self.global_mean_amount,
            "std_amount": self.global_std_amount,
            "tx_count": 1,
            "avg_step": self.global_mean_step,
            "std_step": self.global_std_step,
        }

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        data = self._clean(df).copy()
        data = data.sort_values(["nameOrig", "step"]).copy()

        hour_of_day = (data["step"] % 24).astype(int)
        data["hour_of_day"] = hour_of_day
        data["is_night_tx"] = data["hour_of_day"].isin([0, 1, 2, 3, 4, 5, 22, 23]).astype(int)

        sender_list = data["nameOrig"].astype(str).tolist()
        dest_list = data["nameDest"].astype(str).tolist()
        stats_list = [self.sender_stats.get(sender, self._default_sender_stats()) for sender in sender_list]

        data["sender_avg_amount"] = [s["avg_amount"] for s in stats_list]
        data["sender_tx_count"] = [s["tx_count"] for s in stats_list]
        data["sender_avg_step"] = [s["avg_step"] for s in stats_list]
        data["sender_step_std"] = [s["std_step"] for s in stats_list]

        # PDF-style behavior features
        data["amount_dev_from_avg"] = (data["amount"] - data["sender_avg_amount"]).abs() / (data["sender_avg_amount"] + 1.0)
        data["time_deviation"] = (data["step"] - data["sender_avg_step"]).abs() / (data["sender_step_std"] + 1.0)

        # Frequency anomaly proxy
        data["freq_anomaly"] = (data["sender_tx_count"] / (self.global_max_tx_count + 1.0)).clip(0, 1)

        # New beneficiary risk
        data["is_new_beneficiary"] = [
            0 if dest in self.sender_dest_map.get(sender, set()) else 1
            for sender, dest in zip(sender_list, dest_list)
        ]

        # Transaction velocity proxy
        data["transaction_velocity_proxy"] = (data["sender_tx_count"] / (data["time_deviation"] + 1.0)).clip(0, 100)

        # Simple balance behavior
        data["balance_drain_ratio"] = (data["oldbalanceOrg"] - data["newbalanceOrig"]) / (data["oldbalanceOrg"] + 1.0)

        # Final combined behavioral score from 0 to 100
        amt_n = data["amount_dev_from_avg"].clip(0, 5) / 5.0
        freq_n = data["freq_anomaly"].clip(0, 1)
        newb_n = data["is_new_beneficiary"].clip(0, 1)
        night_n = data["is_night_tx"].clip(0, 1)
        time_n = data["time_deviation"].clip(0, 5) / 5.0

        data["behavioral_deviation_score"] = (
            0.30 * amt_n +
            0.20 * freq_n +
            0.20 * newb_n +
            0.15 * night_n +
            0.15 * time_n
        ) * 100.0

        return data