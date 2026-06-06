# ml/behavior_engineer.py

from dataclasses import dataclass, field
from typing import Dict, Set
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
    sender_to_receivers: Dict[str, Set[str]] = field(default_factory=dict)
    sender_to_devices: Dict[str, Set[str]] = field(default_factory=dict)
    sender_to_locations: Dict[str, Set[str]] = field(default_factory=dict)

    receiver_first_step: Dict[str, float] = field(default_factory=dict)
    receiver_total_count: Dict[str, int] = field(default_factory=dict)

    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        data = df.copy()

        defaults = {
            "step": 0,
            "type": "UNKNOWN",
            "nameOrig": "UNKNOWN_SENDER",
            "nameDest": "UNKNOWN_RECEIVER",
            "amount": 0.0,
            "oldbalanceOrg": 0.0,
            "newbalanceOrig": 0.0,
            "oldbalanceDest": 0.0,
            "newbalanceDest": 0.0,
            "device_id": "UNKNOWN_DEVICE",
            "location": "UNKNOWN_LOCATION",
            "city": "UNKNOWN_LOCATION",
            "device_mismatch_flag": 0,
            "location_mismatch_flag": 0,
            "failed_attempts_count": 0,
        }

        for col, default in defaults.items():
            if col not in data.columns:
                data[col] = default

        for col in ["step", "amount", "oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"]:
            data[col] = pd.to_numeric(data[col], errors="coerce").fillna(0)

        for col in ["device_mismatch_flag", "location_mismatch_flag", "failed_attempts_count"]:
            data[col] = pd.to_numeric(data[col], errors="coerce").fillna(0).astype(int)

        if "location" not in data.columns and "city" in data.columns:
            data["location"] = data["city"]

        return data

    def fit(self, df: pd.DataFrame):
        data = self._clean(df).sort_values(["nameOrig", "step"]).copy()

        self.global_mean_amount = float(data["amount"].mean())
        self.global_std_amount = float(data["amount"].std() or 1.0)
        self.global_mean_step = float(data["step"].mean())
        self.global_std_step = float(data["step"].std() or 1.0)

        self.sender_stats = {}
        self.sender_to_receivers = {}
        self.sender_to_devices = {}
        self.sender_to_locations = {}
        self.receiver_first_step = {}
        self.receiver_total_count = {}

        max_tx = 1

        # sender history
        for sender, g in data.groupby("nameOrig", sort=False):
            sender = str(sender)
            tx_count = int(len(g))
            self.sender_stats[sender] = {
                "avg_amount": float(g["amount"].mean()),
                "std_amount": float(g["amount"].std() or 1.0),
                "avg_step": float(g["step"].mean()),
                "std_step": float(g["step"].std() or 1.0),
                "tx_count": tx_count,
            }

            self.sender_to_receivers[sender] = set(g["nameDest"].astype(str).tolist())
            self.sender_to_devices[sender] = set(g["device_id"].astype(str).tolist()) if "device_id" in g.columns else set()
            self.sender_to_locations[sender] = set(g["location"].astype(str).tolist()) if "location" in g.columns else set()

            if tx_count > max_tx:
                max_tx = tx_count

        # receiver history
        for receiver, g in data.groupby("nameDest", sort=False):
            receiver = str(receiver)
            self.receiver_first_step[receiver] = float(g["step"].min())
            self.receiver_total_count[receiver] = int(len(g))

        self.global_max_tx_count = max_tx
        return self

    def _default_sender_stats(self):
        return {
            "avg_amount": self.global_mean_amount,
            "std_amount": self.global_std_amount,
            "avg_step": self.global_mean_step,
            "std_step": self.global_std_step,
            "tx_count": 1,
        }

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        data = self._clean(df).copy()
        data = data.sort_values(["nameOrig", "step"]).copy()

        # basic time features
        data["hour_of_day"] = (data["step"] % 24).astype(int)
        data["is_night_tx"] = data["hour_of_day"].isin([0, 1, 2, 3, 4, 5, 22, 23]).astype(int)

        # row order history inside the current input
        data["sender_tx_count_before"] = data.groupby("nameOrig").cumcount()
        data["receiver_tx_count_before"] = data.groupby("nameDest").cumcount()

        sender_list = data["nameOrig"].astype(str).tolist()
        dest_list = data["nameDest"].astype(str).tolist()
        device_list = data["device_id"].astype(str).tolist()
        location_list = data["location"].astype(str).tolist()

        sender_stats_list = [
            self.sender_stats.get(sender, self._default_sender_stats())
            for sender in sender_list
        ]

        data["sender_avg_amount"] = [s["avg_amount"] for s in sender_stats_list]
        data["sender_std_amount"] = [s["std_amount"] for s in sender_stats_list]
        data["sender_avg_step"] = [s["avg_step"] for s in sender_stats_list]
        data["sender_std_step"] = [s["std_step"] for s in sender_stats_list]

        # PDF-style behavior features
        data["amount_dev_from_avg"] = (
            (data["amount"] - data["sender_avg_amount"]).abs() /
            (data["sender_avg_amount"] + 1.0)
        )

        data["time_deviation"] = (
            (data["step"] - data["sender_avg_step"]).abs() /
            (data["sender_std_step"] + 1.0)
        )

        data["freq_anomaly"] = (
            data["sender_tx_count_before"] / (self.global_max_tx_count + 1.0)
        ).clip(0, 1)

        data["is_new_beneficiary"] = [
            0 if dest in self.sender_to_receivers.get(sender, set()) else 1
            for sender, dest in zip(sender_list, dest_list)
        ]

        # receiver account age proxy
        receiver_first = [
            self.receiver_first_step.get(dest, float(data["step"].iloc[0]))
            for dest in dest_list
        ]
        data["receiver_account_age_steps"] = (data["step"] - pd.Series(receiver_first, index=data.index)).clip(lower=0)

        # device/location mismatch:
        # if a manual flag is already provided, keep it as an extra risk signal too.
        history_device_flag = [
            0 if dev in self.sender_to_devices.get(sender, set()) or len(self.sender_to_devices.get(sender, set())) == 0 else 1
            for sender, dev in zip(sender_list, device_list)
        ]
        history_location_flag = [
            0 if loc in self.sender_to_locations.get(sender, set()) or len(self.sender_to_locations.get(sender, set())) == 0 else 1
            for sender, loc in zip(sender_list, location_list)
        ]

        data["device_mismatch_flag"] = np.maximum(
            pd.Series(history_device_flag, index=data.index).astype(int),
            data["device_mismatch_flag"].astype(int),
        )

        data["location_mismatch_flag"] = np.maximum(
            pd.Series(history_location_flag, index=data.index).astype(int),
            data["location_mismatch_flag"].astype(int),
        )

        data["transaction_velocity_proxy"] = (
            (data["sender_tx_count_before"] + 1) / (data["time_deviation"] + 1.0)
        ).clip(0, 100)

        data["balance_drain_ratio"] = (
            (data["oldbalanceOrg"] - data["newbalanceOrig"]) / (data["oldbalanceOrg"] + 1.0)
        ).clip(-1, 1)

        # final behavior score (0-100)
        amt_n = data["amount_dev_from_avg"].clip(0, 5) / 5.0
        freq_n = data["freq_anomaly"].clip(0, 1)
        newb_n = data["is_new_beneficiary"].clip(0, 1)
        night_n = data["is_night_tx"].clip(0, 1)
        time_n = data["time_deviation"].clip(0, 5) / 5.0
        dev_n = data["device_mismatch_flag"].clip(0, 1)
        loc_n = data["location_mismatch_flag"].clip(0, 1)
        recv_age_n = (1.0 / (data["receiver_account_age_steps"] + 1.0)).clip(0, 1)

        data["behavioral_deviation_score"] = (
            0.20 * amt_n +
            0.14 * freq_n +
            0.16 * newb_n +
            0.12 * night_n +
            0.12 * time_n +
            0.10 * dev_n +
            0.10 * loc_n +
            0.06 * recv_age_n
        ) * 100.0

        return data