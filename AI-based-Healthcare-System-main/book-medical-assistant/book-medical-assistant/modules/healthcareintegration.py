# 

import streamlit as st
import os
import sys
from PIL import Image
import time
import pandas as pd
import numpy as np

# Set page configuration (ONCE only)
st.set_page_config(
    page_title="Integrated Healthcare System",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Add the current directory to system path to import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Create placeholder modules to avoid errors when actual modules are missing
class ModulePlaceholder:
    """Placeholder class for missing modules to avoid errors"""
    def __init__(self, name):
        self.name = name
        
    def __getattr__(self, attr):
        st.error(f"The {self.name} module is missing or could not be imported")
        return lambda *args, **kwargs: None

# Import modules with proper error handling for each one
modules = {}

try:
    import main
    modules["voice_diagnosis_system"] = main
except ImportError:
    modules["voice_diagnosis_system"] = ModulePlaceholder("Voice Diagnosis")

try:
    import lab
    modules["lab_system"] = lab
except ImportError:
    modules["lab_system"] = ModulePlaceholder("Lab Management")

try:
    import labassistant
    modules["lab_assistant_system"] = labassistant
except ImportError:
    modules["lab_assistant_system"] = ModulePlaceholder("Lab Assistant")

try:
    import IMAGINGSYSTEMMAIN
    modules["imaging_system"] = IMAGINGSYSTEMMAIN
except ImportError:
    modules["imaging_system"] = ModulePlaceholder("Medical Imaging")

# Custom CSS for styling
st.markdown("""
    <style>
    .main-header {
        font-size: 2.5rem;
        color: #0047AB;
        text-align: center;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.5rem;
        color: #2E8B57;
        margin-bottom: 1rem;
    }
    .module-container {
        background-color: #f5f5f5;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    .sidebar-content {
        padding: 20px;
    }
    </style>
    """, unsafe_allow_html=True)

# Create a container for the header
header_container = st.container()
with header_container:
    st.markdown("<h1 class='main-header'>Integrated Healthcare System</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center;'>Combining Voice Diagnosis, Lab Management, and Medical Imaging Analysis</p>", unsafe_allow_html=True)

# Create sidebar for navigation
st.sidebar.markdown("<div class='sidebar-content'>", unsafe_allow_html=True)
st.sidebar.image("https://raw.githubusercontent.com/streamlit/streamlit/master/examples/data/medical-icon.png", use_column_width=True)
st.sidebar.markdown("## Navigation")

# Create radio button for system selection
selected_system = st.sidebar.radio(
    "Select System:",
    ["Home", "Voice Medical Diagnosis", "Lab Management", "Lab Assistant", "Medical Imaging Analysis"]
)

st.sidebar.markdown("---")
st.sidebar.markdown("### System Information")
st.sidebar.info("""
    This integrated platform combines three healthcare systems:
    - Voice-based Medical Diagnosis
    - Laboratory Report Management
    - Medical Imaging Analysis
    
    Select a system from the options above to begin.
""")

st.sidebar.markdown("---")
st.sidebar.markdown("### Help & Support")
if st.sidebar.button("Contact Support"):
    st.sidebar.success("Support ticket created! Our team will contact you shortly.")

st.sidebar.markdown("</div>", unsafe_allow_html=True)

# Home Page
if selected_system == "Home":
    st.markdown("<div class='module-container'>", unsafe_allow_html=True)
    st.markdown("<h2 class='sub-header'>Welcome to the Integrated Healthcare System</h2>", unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("### Voice Medical Diagnosis")
        st.markdown("""
        The voice-based diagnosis system uses AI to:
        - Analyze patient symptoms through speech
        - Provide preliminary medical assessments
        - Recommend appropriate next steps
        """)
        if st.button("Go to Voice Diagnosis", key="voice_btn"):
            st.session_state.selected_system = "Voice Medical Diagnosis"
            st.experimental_rerun()
    
    with col2:
        st.markdown("### Lab Management")
        st.markdown("""
        The lab management system helps:
        - Organize and track patient samples
        - Manage laboratory reports
        - Monitor test statuses and results
        """)
        if st.button("Go to Lab Management", key="lab_btn"):
            st.session_state.selected_system = "Lab Management"
            st.experimental_rerun()
    
    with col3:
        st.markdown("### Medical Imaging")
        st.markdown("""
        The imaging analysis system can:
        - Process X-rays and CT scans
        - Detect abnormalities using AI
        - Generate detailed diagnostic reports
        """)
        if st.button("Go to Medical Imaging", key="imaging_btn"):
            st.session_state.selected_system = "Medical Imaging Analysis"
            st.experimental_rerun()
    
    st.markdown("</div>", unsafe_allow_html=True)
    
    # System statistics (placeholder data)
    st.markdown("<h3 class='sub-header'>System Statistics</h3>", unsafe_allow_html=True)
    
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Patients", "1,245", "+12")
    col2.metric("Diagnoses Made", "892", "+8")
    col3.metric("Lab Reports", "567", "+15")
    col4.metric("Images Analyzed", "723", "+6")
    
    # Recent activity
    st.markdown("<h3 class='sub-header'>Recent Activity</h3>", unsafe_allow_html=True)
    
    activity_data = [
        {"time": "10:45 AM", "system": "Voice Diagnosis", "activity": "New patient assessment completed"},
        {"time": "09:30 AM", "system": "Lab Management", "activity": "5 new lab reports processed"},
        {"time": "08:15 AM", "system": "Medical Imaging", "activity": "CT scan analysis completed"},
        {"time": "Yesterday", "system": "Lab Assistant", "activity": "Weekly lab statistics generated"}
    ]
    
    for activity in activity_data:
        st.markdown(f"**{activity['time']}** - *{activity['system']}*: {activity['activity']}")

# Voice Medical Diagnosis System
elif selected_system == "Voice Medical Diagnosis":
    st.markdown("<div class='module-container'>", unsafe_allow_html=True)
    st.markdown("<h2 class='sub-header'>Voice Medical Diagnosis System</h2>", unsafe_allow_html=True)
    
    # Check if module is available before running
    if isinstance(modules["voice_diagnosis_system"], ModulePlaceholder):
        st.warning("Voice Diagnosis System module is not available. Please make sure 'main.py' is in the correct location.")
    
    # Run the voice diagnosis system (even if module is missing)
    st.write("Voice Medical Diagnosis System is active")
    
    # Record audio button
    if st.button("Start Voice Recording"):
        with st.spinner("Recording voice..."):
            time.sleep(2)  # Simulate recording process
        st.success("Recording completed!")
        
    # Sample symptoms input if voice recording is not available
    symptoms = st.text_area("Or type your symptoms here:", height=150)
    
    # Process the symptoms if provided
    if symptoms and st.button("Analyze Symptoms"):
        with st.spinner("Analyzing symptoms..."):
            time.sleep(3)  # Simulate analysis process
        
        st.success("Analysis complete!")
        st.write("Preliminary Diagnosis:")
        
        # Mock diagnosis result - this would be replaced with actual logic
        if "headache" in symptoms.lower() and "fever" in symptoms.lower():
            st.warning("Possible Influenza. Recommendation: Rest, fluids, and consider consulting a physician.")
        elif "cough" in symptoms.lower() and "shortness of breath" in symptoms.lower():
            st.warning("Possible Respiratory Infection. Recommendation: Immediate medical consultation advised.")
        else:
            st.info("Symptoms not specifically matched. Recommendation: Consider a general consultation.")
        
        # Show next steps
        st.subheader("Recommended Next Steps:")
        st.markdown("""
        1. Consult with a healthcare professional
        2. Complete laboratory tests if recommended
        3. Follow treatment plan as prescribed
        """)
    
    st.markdown("</div>", unsafe_allow_html=True)

# Lab Management System
elif selected_system == "Lab Management":
    st.markdown("<div class='module-container'>", unsafe_allow_html=True)
    st.markdown("<h2 class='sub-header'>Laboratory Management System</h2>", unsafe_allow_html=True)
    
    # Check if module is available before running
    if isinstance(modules["lab_system"], ModulePlaceholder):
        st.warning("Lab Management System module is not available. Please make sure 'lab.py' is in the correct location.")
    
    # Run the lab system (even if module is missing)
    st.write("Laboratory Management System is active")
    
    # Sample lab management interface
    lab_tabs = st.tabs(["Sample Registration", "Test Management", "Results Reporting"])
    
    with lab_tabs[0]:
        st.subheader("Patient Sample Registration")
        
        col1, col2 = st.columns(2)
        with col1:
            patient_id = st.text_input("Patient ID")
            patient_name = st.text_input("Patient Name")
        
        with col2:
            sample_type = st.selectbox("Sample Type", ["Blood", "Urine", "CSF", "Tissue", "Other"])
            collection_date = st.date_input("Collection Date")
        
        if st.button("Register Sample"):
            with st.spinner("Registering sample..."):
                time.sleep(1.5)  # Simulate registration process
            st.success(f"Sample for {patient_name} (ID: {patient_id}) registered successfully!")
    
    with lab_tabs[1]:
        st.subheader("Test Management")
        
        test_types = st.multiselect(
            "Select Tests to Perform",
            ["Complete Blood Count", "Metabolic Panel", "Lipid Profile", "Thyroid Function", "Liver Function", "Kidney Function"]
        )
        
        priority = st.radio("Test Priority", ["Routine", "Urgent", "STAT"])
        
        if test_types and st.button("Assign Tests"):
            with st.spinner("Assigning tests..."):
                time.sleep(1)  # Simulate test assignment
            
            st.success(f"{len(test_types)} tests assigned with {priority} priority!")
            for i, test in enumerate(test_types):
                st.write(f"{i+1}. {test} - Estimated completion: {priority} queue")
    
    with lab_tabs[2]:
        st.subheader("Results Reporting")
        
        # Sample completed tests (would be pulled from database in real app)
        completed_tests = {
            "T0001": {"patient": "John Doe", "test": "Complete Blood Count", "status": "Completed"},
            "T0002": {"patient": "Jane Smith", "test": "Lipid Profile", "status": "Pending Review"},
            "T0003": {"patient": "Robert Johnson", "test": "Metabolic Panel", "status": "In Process"}
        }
        
        selected_test = st.selectbox("Select Test ID", list(completed_tests.keys()))
        
        if selected_test:
            test_info = completed_tests[selected_test]
            st.write(f"Patient: {test_info['patient']}")
            st.write(f"Test: {test_info['test']}")
            st.write(f"Status: {test_info['status']}")
            
            if test_info["status"] == "Completed":
                st.download_button("Download Report", "Sample test report content", f"report_{selected_test}.pdf")
            else:
                st.info(f"Report not available yet. Current status: {test_info['status']}")
    
    st.markdown("</div>", unsafe_allow_html=True)

# Lab Assistant System
elif selected_system == "Lab Assistant":
    st.markdown("<div class='module-container'>", unsafe_allow_html=True)
    st.markdown("<h2 class='sub-header'>Lab Assistant System</h2>", unsafe_allow_html=True)
    
    # Check if module is available before running
    if isinstance(modules["lab_assistant_system"], ModulePlaceholder):
        st.warning("Lab Assistant System module is not available. Please make sure 'labassistant.py' is in the correct location.")
    
    # Run the lab assistant system (even if module is missing)
    st.write("Laboratory Assistant System is active")
    
    # Sample lab assistant interface
    assistant_tabs = st.tabs(["Report Generation", "Data Analysis", "Lab Statistics"])
    
    with assistant_tabs[0]:
        st.subheader("Automated Report Generation")
        
        report_type = st.selectbox(
            "Report Type",
            ["Daily Activity Summary", "Weekly Test Volume", "Monthly Performance", "Custom Report"]
        )
        
        if report_type == "Custom Report":
            start_date = st.date_input("Start Date")
            end_date = st.date_input("End Date")
            report_metrics = st.multiselect(
                "Include Metrics",
                ["Test Volume", "Turnaround Time", "Error Rate", "Staff Performance", "Equipment Utilization"]
            )
        
        if st.button("Generate Report"):
            with st.spinner("Generating report..."):
                time.sleep(2)  # Simulate report generation
            
            st.success("Report generated successfully!")
            st.download_button(
                "Download Report",
                "This is a sample report content",
                f"lab_report_{report_type.lower().replace(' ', '_')}.pdf"
            )
    
    with assistant_tabs[1]:
        st.subheader("Lab Data Analysis")
        
        # Sample data visualization
        st.write("Sample Test Volume Trend (Last 7 Days)")
        
        # Generate sample data
        dates = pd.date_range(end=pd.Timestamp.now(), periods=7)
        test_counts = np.random.randint(30, 80, size=7)
        
        df = pd.DataFrame({
            'Date': dates,
            'Test Count': test_counts
        })
        
        st.line_chart(df.set_index('Date'))
        
        # Sample analysis insights
        st.subheader("Analysis Insights")
        st.info("Test volume shows a 15% increase compared to previous week")
        st.info("Average turnaround time: 24.3 hours")
        st.info("Most common test type: Complete Blood Count (28%)")
    
    with assistant_tabs[2]:
        st.subheader("Laboratory Statistics")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("Tests Completed Today", "47", "+5")
            st.metric("Pending Results", "12", "-3")
            st.metric("Average Turnaround Time", "24.3 hours", "-2.1 hours")
        
        with col2:
            st.metric("On-time Completion Rate", "94%", "+2%")
            st.metric("Sample Rejection Rate", "2.1%", "-0.5%")
            st.metric("Staff Utilization", "87%", "+3%")
    
    st.markdown("</div>", unsafe_allow_html=True)

# Medical Imaging Analysis System
elif selected_system == "Medical Imaging Analysis":
    st.markdown("<div class='module-container'>", unsafe_allow_html=True)
    st.markdown("<h2 class='sub-header'>Medical Imaging Analysis System</h2>", unsafe_allow_html=True)
    
    # Check if module is available before running
    if isinstance(modules["imaging_system"], ModulePlaceholder):
        st.warning("Medical Imaging System module is not available. Please make sure 'IMAGINGSYSTEMMAIN.py' is in the correct location.")
    
    # Run the imaging system (even if module is missing)
    st.write("Medical Imaging Analysis System is active")
    
    # Sample imaging analysis interface
    imaging_tabs = st.tabs(["Upload Image", "Analysis Results", "Patient Records"])
    
    with imaging_tabs[0]:
        st.subheader("Upload Medical Image")
        
        col1, col2 = st.columns(2)
        
        with col1:
            patient_id = st.text_input("Patient ID", key="img_patient_id")
            scan_type = st.selectbox("Scan Type", ["X-Ray", "CT Scan", "MRI", "Ultrasound", "PET Scan"])
            body_part = st.selectbox("Body Part", ["Chest", "Brain", "Abdomen", "Pelvis", "Extremities", "Spine"])
        
        with col2:
            uploaded_file = st.file_uploader("Upload Image", type=["jpg", "png", "dcm"])
            
            if uploaded_file is not None:
                try:
                    image = Image.open(uploaded_file)
                    st.image(image, caption="Uploaded Image", use_column_width=True)
                except Exception as e:
                    st.error(f"Error displaying image: {e}")
                    st.info("If this is a DICOM file, it requires special processing.")
        
        if uploaded_file is not None and st.button("Analyze Image"):
            with st.spinner("Analyzing medical image..."):
                time.sleep(3)  # Simulate image analysis
            
            st.success("Analysis complete!")
            st.session_state.analysis_complete = True
            
            # Generate mock findings
            findings = {
                "X-Ray": {
                    "Chest": "No significant abnormalities detected. Cardiac silhouette and pulmonary vasculature appear normal.",
                    "Extremities": "No fractures or dislocations detected. Joint spaces preserved."
                },
                "CT Scan": {
                    "Brain": "No acute intracranial hemorrhage, mass effect, or midline shift. Ventricles are normal in size.",
                    "Abdomen": "Liver, spleen, and pancreas appear normal. No free fluid or inflammation detected."
                }
            }
            
            if scan_type in findings and body_part in findings[scan_type]:
                st.session_state.findings = findings[scan_type][body_part]
            else:
                st.session_state.findings = "Analysis completed. No significant abnormalities detected."
            
            # Switch to results tab after analysis
            st.experimental_rerun()
    
    with imaging_tabs[1]:
        st.subheader("Analysis Results")
        
        if hasattr(st.session_state, 'analysis_complete') and st.session_state.analysis_complete:
            st.write("Analysis completed successfully.")
            
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.subheader("Findings:")
                st.write(st.session_state.findings)
                
                st.subheader("AI Detection Highlights:")
                st.info("Region of interest identification completed")
                st.info("Abnormality detection algorithm applied")
                st.info("Comparative analysis with reference dataset completed")
            
            with col2:
                st.subheader("Confidence Metrics:")
                st.progress(0.92)
                st.write("92% - Analysis Confidence")
                
                st.progress(0.88)
                st.write("88% - Feature Detection")
                
                st.progress(0.95)
                st.write("95% - Classification Accuracy")
            
            st.download_button("Download Full Report", "This is a sample medical imaging report", "imaging_report.pdf")
        else:
            st.info("No analysis results available. Please upload and analyze an image first.")
    
    with imaging_tabs[2]:
        st.subheader("Patient Imaging Records")
        
        # Sample patient search
        search_id = st.text_input("Search Patient ID")
        
        if search_id and st.button("Search Records"):
            with st.spinner("Searching records..."):
                time.sleep(1.5)  # Simulate search process
            
            # Mock patient records
            if search_id.startswith("P"):
                st.success(f"Found records for Patient ID: {search_id}")
                
                st.write("**Recent Imaging Studies:**")
                
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    st.write("**Chest X-Ray**")
                    st.write("Date: 2023-03-15")
                    st.write("Status: Completed")
                    if st.button("View Report", key="report1"):
                        st.info("Chest X-Ray report would display here")
                
                with col2:
                    st.write("**Brain CT Scan**")
                    st.write("Date: 2023-02-22")
                    st.write("Status: Completed")
                    if st.button("View Report", key="report2"):
                        st.info("Brain CT report would display here")
                
                with col3:
                    st.write("**Abdominal Ultrasound**")
                    st.write("Date: 2023-01-08")
                    st.write("Status: Completed")
                    if st.button("View Report", key="report3"):
                        st.info("Ultrasound report would display here")
            else:
                st.warning(f"No records found for Patient ID: {search_id}")
                st.info("Try searching with a patient ID starting with 'P'")
    
    st.markdown("</div>", unsafe_allow_html=True)

# Footer
st.markdown("---")
footer_col1, footer_col2, footer_col3 = st.columns(3)
with footer_col1:
    st.markdown("### Quick Links")
    st.markdown("[Documentation](#)")
    st.markdown("[Training Resources](#)")
    st.markdown("[FAQs](#)")

with footer_col2:
    st.markdown("### Support")
    st.markdown("[Contact Help Desk](#)")
    st.markdown("[Report Issue](#)")
    st.markdown("[Request Feature](#)")

with footer_col3:
    st.markdown("### System Info")
    st.markdown("Version: 1.0.3")
    st.markdown("Last Updated: April 2025")
    st.markdown("[Release Notes](#)")

# Add system check when the app starts
if 'system_checked' not in st.session_state:
    st.session_state.system_checked = True
    
    # Check missing modules and display warnings
    module_files = {
        "main.py": "Voice Medical Diagnosis System",
        "lab.py": "Laboratory Management System",
        "labassistant.py": "Laboratory Assistant System",
        "IMAGINGSYSTEMMAIN.py": "Medical Imaging Analysis System"
    }
    
    missing_modules = []
    for module_file, module_name in module_files.items():
        if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), module_file)):
            missing_modules.append(f"{module_file} ({module_name})")
    
    if missing_modules:
        st.warning(f"The following module files are missing: {', '.join(missing_modules)}")
        st.info("The application will still run, but functionality related to these modules will be limited.")