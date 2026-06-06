import pandas as pd
from behavior_engineer import BehaviorFeatureEngineer

# Load original dataset
df = pd.read_csv("fraud_dataset.csv")

# Optional: use sample for speed
if len(df) > 200000:
    df = df.sample(n=200000, random_state=42)

# Apply feature engineering
engineer = BehaviorFeatureEngineer().fit(df)
df_fe = engineer.transform(df)

# Save new CSV
df_fe.to_csv("fraud_dataset_features.csv", index=False)

print("Feature engineered CSV saved as fraud_dataset_features.csv")