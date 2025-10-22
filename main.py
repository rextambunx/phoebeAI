import requests
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import mysql.connector
from datetime import datetime
import pickle
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_community.vectorstores import Chroma
import re
from urllib.parse import urlencode
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")

# Load vector database from folder
vector_store = Chroma(
    persist_directory="./policy_vector_store",
    embedding_function=embeddings
)

def read_policy(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read().strip()

work_rules = read_policy("swt_policy.txt")

def get_relevant_policy(question: str, k: int = 3):
    results = vector_store.similarity_search(question, k=k)
    return "\n".join([r.page_content for r in results])

# with open("myteam.json", "r", encoding="utf-8") as f:
#     Myteam = json.load(f)

url = "https://swthrapp.azurewebsites.net/weekly_survey?survey_id=4&company_id=3&year=2025"

response = requests.get(url)
response.raise_for_status()
feedback = response.json()

# ฐานข้อมูล User
import requests
import json

# ดึงข้อมูลจาก URL แทนการเปิดไฟล์
url_role = "https://swthrapp.azurewebsites.net/user_team_role"
response = requests.get(url_role)
response.raise_for_status()
role = response.json()

with open("known_websites.json", "r", encoding="utf-8") as f:
    website = json.load(f)

response = requests.post("https://swthrapp.azurewebsites.net/user_info")
myteam_infomation = response.json()

# ------------------------Timestamp----------------------------
def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# ----------------- Role-Based Data Filtering -----------------
def filter_database_by_role(database, current_role, current_user_id, role_view_employee_ids):
    """
    Filter database based on user role
    - Admin: See all data
    - Manager: See own data + team data (role_view_employee_id)
    - Staff: See only own data
    """
    if current_role == "Admin":
        return database
    
    # ✅ ถ้าเป็น Staff ให้ดูเฉพาะตัวเองเท่านั้น
    if current_role == "Staff":
        allowed_employee_ids = {current_user_id}
    else:
        # Manager ดูได้ตาม role_view_employee_ids
        allowed_employee_ids = set(role_view_employee_ids)
    
    # Filter the database
    filtered_db = {"years": {}}
    
    for year, employees in database.get("years", {}).items():
        filtered_db["years"][year] = {}
        for emp_id, emp_data in employees.items():
            if emp_id in allowed_employee_ids:
                filtered_db["years"][year][emp_id] = emp_data
    
    return filtered_db

def filter_feedback_by_role(feedback, current_role, current_user_id, role_view_employee_ids, role_data):
    """
    Filter feedback based on user role
    - Admin: See all feedback
    - Manager: See own feedback + team feedback
    - Staff: See only own feedback
    """
    if current_role == "Admin":
        return feedback
    
    # ✅ สร้าง mapping ระหว่าง name (key) กับ employee_id
    name_to_employee_id = {}
    for key, employee in role_data.items():
        name_to_employee_id[key] = employee.get("employee_id")
    
    # ✅ ถ้าเป็น Staff ให้ดูเฉพาะตัวเองเท่านั้น
    if current_role == "Staff":
        allowed_employee_ids = {current_user_id}
    else:
        # Manager ดูได้ตาม role_view_employee_ids
        allowed_employee_ids = set(role_view_employee_ids)
    
    # Filter feedback list
    filtered_feedback = []
    for item in feedback:
        # ✅ ดึง name จาก feedback แล้วแปลงเป็น employee_id
        name = item.get("name", "")
        emp_id = name_to_employee_id.get(name)
        
        if emp_id and emp_id in allowed_employee_ids:
            filtered_feedback.append(item)
    
    return filtered_feedback

# -------------------------------------------------------------
def load_database_from_mysql():
    conn = mysql.connector.connect(
        host="swtmysqldbserver.mysql.database.azure.com",
        port=3306,
        user="rex_ai",
        password="XdG6d2oWeY",
        database="swthrapp"
    )
    cursor = conn.cursor(dictionary=True)

    # ----- Leave Quota -----
    cursor.execute("SELECT * FROM view_leave_quota")
    leave_quota_raw = cursor.fetchall()
    leave_quota = {}

    for row in leave_quota_raw:
        y = str(row['year'])
        emp_id = row['employee_id']

        if y not in leave_quota:
            leave_quota[y] = {}

        leave_quota[y][emp_id] = {
            "employee_id": emp_id,
            "company_id": row['company_id'],
            "employee_name": row['employee_name'],
            "employee_nickname": row['employee_nickname'],
            "employee_team": row['employee_team'],
            "quota": {
                "annual": row['annual_quota'],
                "sick": row['sick_quota'],
                "personal": row['personal_quota']
            }
        }

    # ----- Leave Summary -----
    cursor.execute("SELECT * FROM view_leave_log_event")
    leave_summary_raw = cursor.fetchall()
    leave_summary = {}

    for row in leave_summary_raw:
        y = str(row['year'])
        emp_id = row['employee_id']

        if y not in leave_summary:
            leave_summary[y] = {}

        if emp_id not in leave_summary[y]:
            leave_summary[y][emp_id] = {
                "employee_id": emp_id,
                "company_id": row['company_id'],
                "employee_name": row['employee_name'],
                "employee_nickname": row['employee_nickname'],
                "employee_team": row['employee_team'],
                "leaves": []
            }

        leave_summary[y][emp_id]["leaves"].append({
            "leave_type": row['leave_type'],
            "used_day": row['used_day'],
            "date": row['date'].isoformat() if hasattr(row['date'], "isoformat") else str(row['date'])
        })

    cursor.close()
    conn.close()

    # Merge into single structure
    database = {"years": {}}
    for y in set(leave_quota.keys()) | set(leave_summary.keys()):
        database["years"][y] = {}
        emp_ids = set(leave_quota.get(y, {}).keys()) | set(leave_summary.get(y, {}).keys())

        for emp_id in emp_ids:
            database["years"][y][emp_id] = {
                **leave_quota.get(y, {}).get(emp_id, {}),
                **leave_summary.get(y, {}).get(emp_id, {"leaves": []})
            }

    return database

database_memory = load_database_from_mysql()

# Insert your API KEY from Google AI Studio
API_KEY = "AIzaSyDmJiUxDzzJLjpvHROxG1DDuzDzNUkfWy4"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"

# ----------------- Leave URL Generation Functions -----------------
def create_leave_url(leave_type, reason, from_date, to_date, period1="fullday", period2="", withoutpay=0):
    """
    Create URL for leave request
    
    Parameters:
    - leave_type: "sick", "annual", "personal"
    - reason: Reason for leave
    - from_date: Start date (YYYY-MM-DD)
    - to_date: End date (YYYY-MM-DD)
    - period1: "fullday", "halfday"
    - period2: "morning", "afternoon" (if period1="halfday")
    - withoutpay: 0 or 1
    """
    base_url = "https://swthrapp.azurewebsites.net/leave/add"
    
    params = {
        "type": leave_type,
        "reason": reason,
        "from": from_date,
        "to": to_date,
        "period1": period1,
        "withoutpay": withoutpay
    }
    
    # Add period2 if halfday
    if period1 == "halfday" and period2:
        params["period2"] = period2
    
    # Create URL with query parameters
    full_url = f"{base_url}?{urlencode(params)}"
    return full_url

def extract_leave_reason(question):
    """Extract leave reason from message"""
    patterns = [
        r"because\s+(.+?)(?:\s|$)",
        r"due to\s+(.+?)(?:\s|$)",
        r"เพราะ(.+?)(?:\s|$)",
        r"เนื่องจาก(.+?)(?:\s|$)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, question, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    
    # ✅ เพิ่ม default reasons สำหรับ leave type ใหม่
    question_lower = question.lower()
    if "sick" in question_lower or "ป่วย" in question_lower:
        return "Not feeling well"
    elif "annual" in question_lower or "พักร้อน" in question_lower:
        return "Annual leave"
    elif "personal" in question_lower or "กิจ" in question_lower:
        return "Personal business"
    elif "wfh" in question_lower or "work from home" in question_lower or "ทำงานที่บ้าน" in question_lower:
        return "Work from home"
    elif "business" in question_lower or "ธุรกิจ" in question_lower or "ไปต่างจังหวัด" in question_lower:
        return "Business travel"
    elif "family" in question_lower or "ครอบครัว" in question_lower:
        return "Family leave"
    elif "external" in question_lower or "กิจกรรมภายนอก" in question_lower:
        return "External activity"
    elif "other" in question_lower or "อื่นๆ" in question_lower:
        return "Other leave"
    
    return "Leave request"

@app.post("/chat")
def chat(payload: dict, user_id: int = None):

    # ✅ รับ user_id จาก query parameter
    if not user_id:
        return {"error": "Please provide user_id in query parameter"}
    
    # ✅ ค้นหาข้อมูลพนักงานจาก role (เป็น dict)
    current_user_data = None
    for key, employee in role.items():
        if employee.get("employee_id") == user_id:
            current_user_data = employee
            break
    
    if not current_user_data:
        return {"error": f"Employee with ID {user_id} not found"}
    
    # ✅ ดึงข้อมูลพนักงานที่ login (ใช้ role จริง)
    current_user = user_id  # ✅ เก็บเป็น int แทน string
    current_name = current_user_data.get("employee_name", "Unknown")
    current_role = current_user_data.get("role", "Staff")
    role_view_employee_ids = current_user_data.get("role_view_employee_id", [user_id])
    
    print(f"👤 Current User: {current_name}")
    print(f"🆔 User ID: {user_id}")
    print(f"🔐 Role: {current_role}")
    print(f"👥 Can view employee IDs: {role_view_employee_ids}")
    
    question = payload["message"]
    current_time = get_current_time()
    
    # Get relevant policy from vector database
    relevant_policy = get_relevant_policy(question)

    # ✅ Filter data based on role
    filtered_database = filter_database_by_role(
        database_memory, 
        current_role, 
        current_user,
        role_view_employee_ids
    )
    
    filtered_feedback = filter_feedback_by_role(
        feedback, 
        current_role, 
        current_user,
        role_view_employee_ids,
        role
    )
    
    # ✅ เพิ่มข้อมูลพนักงานทั้งหมด (ไม่กรอง) สำหรับคำถามทั่วไป
    all_employees = role  # ข้อมูลพนักงานทั้งหมด
    
    KNOWN_WEBSITES = {
        "skywave": "https://www.skywavetechnologies.com",
        "google": "https://www.google.com",
        "youtube": "https://www.youtube.com",
    }

    # Check for website opening requests
    if any(word in question.lower() for word in ["open website", "go to", "เปิดเว็บ", "เข้าเว็บ"]):
        for key, url in KNOWN_WEBSITES.items():
            if key in question.lower():
                return {"action": "open_website", "url": url, "message": f"Opening {key} website..."}

    # Create prompt for AI
    prompt = f"""
You are **SkyBot**, an HR Assistant for Skywave Technologies (SWT) company.

### COMPANY PROFILE
Skywave Technologies is a 100% German owned IT company in Bangkok that specializes in customized Software Solutions & Digital Content Development, as well as IT Consulting, Maintenance and Support. As an expert company in software development, we are promoted by the Thailand Board of Investment (BOI).
Our team is international, and we work for clients in Thailand, other ASEAN countries, in Australia and in Europe. 
We also are a Certified Development Agency for one of Germany's global Pharma & Healthcare Organizations. 
At the heart of our business values are our service excellence based on years of experience in working with international clients, our outstanding customer orientation, reliability and open communication style in various languages.

# You are a polite and friendly assistant
- If there's a question, answer it clearly
- For greetings or short messages, respond appropriately and politely

### SYSTEM DATETIME
{current_time}

### RELEVANT COMPANY POLICY
{work_rules}

### EMPLOYEE DIRECTORY (✅ PUBLIC - Available to everyone)
{all_employees}
**Note:** This employee directory is available to all employees. You can answer questions about:
- Who works in which team
- Employee names, nicknames, and roles
- Team structure
- General employee information
This information is NOT restricted.

### MY TEAM employee information
{myteam_infomation}

### EMPLOYEE FEEDBACK (⚠️ RESTRICTED - Filtered based on your access level)
{filtered_feedback}
**⚠️ IMPORTANT:** This feedback data is filtered based on user role.
- You can ONLY see feedback for employees you have permission to view
- If asked about feedback, explain and summarize ONLY the data you can see
- If no data is visible, politely inform the user they don't have permission

### DATABASE - Leave Data (⚠️ RESTRICTED - Filtered based on your access level)
{filtered_database}
**⚠️ IMPORTANT:** This leave data is filtered based on user role.
- You can ONLY see leave data for employees you have permission to view
- Provide accurate numbers ONLY for employees in your permission scope
- If asked about leave data you cannot see, politely inform the user they don't have permission

### WEBSITES
{website}

### ACCESS CONTROL RULES
Current User Role: {current_role}
Current User Employee ID: {current_user}
Restricted Data Access for Employee IDs: {role_view_employee_ids}

**Access Rules Summary:**
1. ✅ **EMPLOYEE DIRECTORY**: Everyone can see (no restrictions)
2. ⚠️ **FEEDBACK**: Restricted by role (Admin=all, Manager=team, Staff=self only)
3. ⚠️ **LEAVE DATA**: Restricted by role (Admin=all, Manager=team, Staff=self only)

### CURRENT USER
Name: {current_name}
Role: {current_role}
Employee ID: {current_user}

### USER QUESTION
{question}

### IMPORTANT: LEAVE REQUEST DETECTION
If the message is a leave request (sick leave, personal leave, annual leave, etc.), respond in JSON format:

{{{{
  "action": "leave_request",
  "data": {{{{
    "employee_name": "{current_name}",
    "leave_type": "annual" or "personal" or "sick" or "other" or "wfh" or "business" or "family" or "external",
    "leave_date": "YYYY-MM-DD",
    "leave_date_end": "YYYY-MM-DD" (if multiple days, otherwise same as leave_date),
    "reason": "Reason for leave (if mentioned, otherwise use default)",
    "period": "fullday" or "halfday",
    "half_period": "morning" or "afternoon" (if period="halfday"),
    "message": "Confirmation message"
  }}}}
}}}}

Leave Type Mapping:
- "annual" = Annual Leave (ลาพักร้อน)
- "personal" = Personal Leave (ลากิจ)
- "sick" = Sick Leave (ลาป่วย)
- "other" = Other Leave (ลาอื่นๆ)
- "wfh" = Work From Home (ทำงานที่บ้าน)
- "business" = Business Travel (เดินทางไปธุระ)
- "family" = Family Leave (ลาครอบครัว)
- "external" = External Activity (กิจกรรมภายนอก)

Notes:
- Always use current user name: {current_name}
- If "today" is mentioned, use date {datetime.now().strftime("%Y-%m-%d")}
- leave_type: "sick" = sick leave, "annual" = annual leave, "personal" = personal leave
- period: "fullday" = full day, "halfday" = half day
- half_period: "morning" or "afternoon" (when period="halfday")
- If period not specified, use "fullday" as default
"""

    # Call Gemini API
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "topK": 1,
            "topP": 0.1
        }
    }

    res = requests.post(GEMINI_URL, json=body)
    ai_response = res.json()
    
    # Extract response from AI
    try:
        response_text = ai_response["candidates"][0]["content"]["parts"][0]["text"]
        print(f"[DEBUG] AI Response: {response_text}")
        
        # Check if AI sent JSON response
        if '"action": "leave_request"' in response_text:
            # Extract JSON
            json_match = re.search(r'\{[\s\S]*"action":\s*"leave_request"[\s\S]*\}', response_text)
            if json_match:
                leave_data = json.loads(json_match.group())
                
                if leave_data.get("action") == "leave_request" and "data" in leave_data:
                    data = leave_data["data"]
                    
                    # Prepare data for URL creation
                    leave_type = data["leave_type"]
                    from_date = data["leave_date"]
                    to_date = data.get("leave_date_end", from_date)
                    reason = data.get("reason", extract_leave_reason(question))
                    period = data.get("period", "fullday")
                    half_period = data.get("half_period", "morning")
                    
                    # Create URL
                    leave_url = create_leave_url(
                        leave_type=leave_type,
                        reason=reason,
                        from_date=from_date,
                        to_date=to_date,
                        period1=period,
                        period2=half_period if period == "halfday" else "",
                        withoutpay=0
                    )
                    
                    leave_type_display = {
                        "sick": "Sick Leave",
                        "annual": "Annual Leave",
                        "personal": "Personal Leave",
                        "other": "Other Leave",
                        "wfh": "Work From Home",
                        "business": "Business Travel",
                        "family": "Family Leave",
                        "external": "External Activity"
                    }
                    
                    period_display = {
                        "fullday": "Full Day",
                        "halfday": "Half Day"
                    }
                    
                    half_period_display = {
                        "morning": "Morning",
                        "afternoon": "Afternoon"
                    }
                    
                    ai_message = data.get("message", "")
                    
                    period_text = period_display.get(period, "Full Day")
                    if period == "halfday":
                        period_text += f" ({half_period_display.get(half_period, '')})"

                    response_message = f"""Okay {data['employee_name']}! 
{leave_type_display.get(leave_type, leave_type)} - {period_text}
Date: {from_date}{' to ' + to_date if from_date != to_date else ''}
Reason: {reason}

{ai_message if ai_message else 'Take care of your health. Get enough rest. 😊'}

Leave Request Link: {leave_url}
"""
                    
                    return {
                        "action": "open_website",
                        "url": leave_url,
                        "message": response_message,
                        "leave_data": {
                            "employee_name": data["employee_name"],
                            "leave_type": leave_type_display.get(leave_type),
                            "from_date": from_date,
                            "to_date": to_date,
                            "period": period_text,
                            "reason": reason
                        }
                    }
                    
    except Exception as e:
        print(f"[ERROR] Failed to parse leave request: {e}")
    
    # If not a leave request, return normal response
    return ai_response


@app.get("/js/widget_script.js")
def serve_widget_script():
    """Serve the widget JavaScript file"""
    file_path = "js/widget_script_ai.js"
    if os.path.exists(file_path):
        return FileResponse(
            file_path, 
            media_type="application/javascript",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache"
            }
        )
    raise HTTPException(status_code=404, detail="Widget script not found")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))  # ✅ Render จะส่ง PORT มาเอง
    uvicorn.run("main:app", host="0.0.0.0", port=port)
