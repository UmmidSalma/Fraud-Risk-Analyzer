import random
import smtplib
from email.mime.text import MIMEText
from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_risk
from flask_cors import CORS 
import random

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:3000", "http://localhost:3000"])

# In-memory storage for OTPs (for demo purposes)
otp_storage = {}

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

@app.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.json
    email = data.get("email")
    
    if not email:
        return jsonify({"error": "Email required"}), 400
    
    # Generate a 6-digit OTP
    otp = str(random.randint(100000, 999999))
    otp_storage[email] = otp
    
    print(f"OTP for {email}: {otp}")  # In real app, this would send email
    
    return jsonify({"message": "OTP sent successfully"})

@app.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")
    
    if not email or not otp:
        return jsonify({"error": "Email and OTP required"}), 400
    
    stored_otp = otp_storage.get(email)
    if stored_otp and stored_otp == otp:
        del otp_storage[email]  # Clear OTP after successful verification
        return jsonify({"message": "OTP verified"})
    else:
        return jsonify({"error": "Invalid OTP"}), 400

if __name__ == "__main__":
    app.run(debug=True)