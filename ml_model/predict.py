import pickle
import numpy as np

with open("ml_model/model/fraud_model.pkl", "rb") as file:
    model = pickle.load(file)

# Fraud Risk Prediction Function (Reusable ML Module)
def predict_risk(input_data):

    input_array = np.array(input_data).reshape(1, -1)

    prediction = model.predict(input_array)
    probability = model.predict_proba(input_array)

    risk_score = round(float(probability[0][1] * 100), 2) 

    if risk_score <= 30:
        risk_level = "SAFE"
    elif risk_score <= 70:
        risk_level = "MODERATE"
    else:
        risk_level = "HIGH RISK"
    
    result = {
        "prediction": int(prediction[0]),
        "risk_score": risk_score,
        "risk_level": risk_level
    }

    return result

if __name__ == "__main__":
    print("\nEnter Transaction Details:\n")

    amount = int(input("Enter amount: "))
    transaction_hour = int(input("Enter hour (0-23): "))
    is_new_receiver = int(input("New receiver? (1/0): "))
    device_mismatch = int(input("Device mismatch? (1/0): "))
    location_mismatch = int(input("Location mismatch? (1/0): "))
    transaction_count = int(input("Transactions in last hour: "))
    avg_amount_deviation = int(input("Amount deviation (0-100): "))
    is_night = int(input("Night transaction? (1/0): "))
    failed_attempts = int(input("Failed attempts: "))

    input_data = [
        amount, transaction_hour, is_new_receiver,
        device_mismatch, location_mismatch,
        transaction_count, avg_amount_deviation,
        is_night, failed_attempts
    ]

    result = predict_risk(input_data)

    print("\n--- RESULT ---\n")
    print(result)