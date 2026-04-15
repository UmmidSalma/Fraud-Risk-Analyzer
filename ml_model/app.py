from flask import Flask, request, jsonify
from predict import predict_risk

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    input_data = [
        data["amount"],
        data["transaction_hour"],
        data["is_new_receiver"],
        data["device_mismatch"],
        data["location_mismatch"],
        data["transaction_count"],
        data["avg_amount_deviation"],
        data["is_night"],
        data["failed_attempts"]        
    ]

    result = predict_risk(input_data)

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)