# ml/feature_config.py

CATEGORICAL_FEATURES = [
    "type",
]

NUMERIC_FEATURES = [
    "step",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "hour_of_day",
    "is_night_tx",
    "sender_avg_amount",
    "sender_tx_count_before",
    "receiver_tx_count_before",
    "receiver_account_age_steps",
    "amount_dev_from_avg",
    "time_deviation",
    "freq_anomaly",
    "is_new_beneficiary",
    "device_mismatch_flag",
    "location_mismatch_flag",
    "transaction_velocity_proxy",
    "balance_drain_ratio",
    "behavioral_deviation_score",
    "failed_attempts_count",
]

MODEL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES