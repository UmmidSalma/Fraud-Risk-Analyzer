import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
import pickle

data = pd.read_csv("data/fraud_data.csv")

x = data.drop("risk", axis=1)
y = data["risk"]

x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2)

