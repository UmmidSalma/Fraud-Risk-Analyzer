import random
import smtplib
import traceback
from email.mime.text import MIMEText
from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_risk

app = Flask(__name__)
CORS(app, supports_credentials=True) # allow all routes

otp_store = {}

generated_otp = None
user_email = None

EMAIL_ADDRESS = "mdivate588@gmail.com"
EMAIL_PASSWORD = "zhgzqklcxowtxtem"


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

@app.route('/send-otp', methods=['POST'])
def send_otp():
    print("🔥 SEND OTP API HIT")
    data = request.json
    email = data.get('email')

    if not email:
        print("SEND OTP ERROR: missing recipient email")
        return jsonify({"error": "Recipient email is required"}), 400

    otp = str(random.randint(100000, 999999))
    otp_store[email] = otp

    print("OTP GENERATED:", otp)  # for debugging

    if email in otp_store:
        otp = otp_store[email]   # reuse same OTP
    else:
        otp = str(random.randint(100000, 999999))
        otp_store[email] = otp

    # Email content
    msg = MIMEText(f"Your OTP is {otp}")
    msg['Subject'] = "SecureWith.AI OTP"
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = email

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=20)
        server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()

        return jsonify({"message": "OTP sent successfully"})

    except Exception as e:
        print("EMAIL ERROR:", repr(e))
        traceback.print_exc()
        # Fallback for local development when SMTP credentials or Gmail access is blocked
        return jsonify({
            "message": "OTP generated but email send failed",
            "otp": otp,
            "warning": "Check SMTP credentials or Gmail app-password/settings"
        }), 200
    

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = data.get('email')
    user_otp = data.get('otp')

    real_otp = otp_store.get(email)

    print("ENTERED:", user_otp)
    print("STORED:", real_otp)

    if real_otp == user_otp:
        return jsonify({"message": "OTP verified"})
    else:
        return jsonify({"error": "Invalid OTP"}), 400

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response   

    
if __name__ == "__main__":
    app.run(debug=True)