# 🤖 AI Agent Prompt: Interactive Documentation System Setup

*Comprehensive instruction set for AI agents to create intelligent Jupyter notebook documentation systems optimized for Cursor IDE and autonomous development*

---

## 🎯 **AGENT MISSION**

Create a **strategic interactive documentation system** using Jupyter notebooks that serves as an intelligent knowledge hub for any software project. This system should be optimized for AI agent interaction, provide live code execution, and seamlessly integrate with existing documentation.

---

## 📋 **STEP 1: PROJECT ANALYSIS & CONTEXT**

### **A. Analyze Project Structure**
```bash
# Scan the project to understand:
1. Technology stack (languages, frameworks, tools)
2. Existing documentation systems (README, docs/, wiki)
3. API endpoints and services
4. Testing patterns and infrastructure
5. Build and deployment systems
6. Dependencies and package management
```

### **B. Identify Documentation Categories**
Based on project analysis, determine relevant categories:

**Standard Categories:**
- `api-testing/` - API integration, testing, validation
- `analytics/` - Data analysis, monitoring, performance insights  
- `tutorials/` - Learning materials, setup guides
- `architecture/` - System design, patterns, deep dives

**Project-Specific Categories** (adapt based on stack):
- `frontend/` - UI components, styling, user experience
- `backend/` - Server logic, database operations, middleware
- `devops/` - Deployment, infrastructure, CI/CD
- `security/` - Authentication, authorization, vulnerability testing
- `data/` - Data processing, ETL, machine learning
- `mobile/` - Mobile app development, React Native, etc.

### **C. Document Project Context**
```python
PROJECT_CONTEXT = {
    "name": "[PROJECT_NAME]",
    "description": "[PROJECT_DESCRIPTION]", 
    "tech_stack": ["language1", "framework1", "tool1"],
    "documentation_urls": {
        "main": "[MAIN_DOCS_URL]",
        "api": "[API_DOCS_URL]",
        "repo": "[GITHUB_URL]"
    },
    "key_features": ["feature1", "feature2", "feature3"],
    "api_endpoints": ["/api/endpoint1", "/api/endpoint2"],
    "test_environments": {
        "development": "http://localhost:PORT",
        "staging": "https://staging.domain.com",
        "production": "https://production.domain.com"
    }
}
```

---

## 📁 **STEP 2: DIRECTORY STRUCTURE SETUP**

Create the following structure in the project root or docs directory:

```bash
notebooks/
├── index.ipynb                    # 📋 Central intelligence hub
├── README.md                      # 📚 Strategic overview and onboarding
├── [category1]/                   # 🔧 Project-specific categories
├── [category2]/                   # 📊 Based on analysis
├── [category3]/                   # 🎓 Adapt to project needs
├── [category4]/                   # 🏗️ Include relevant categories
├── templates/                     # 📝 Standardized templates
│   ├── notebook-template.ipynb
│   └── AI-AGENT-PROMPT.md
├── completed/                     # ✅ Production-ready notebooks
├── archive/                       # 📦 Version management
└── assets/                        # 🖼️ Images, diagrams, resources
```

---

## 🧠 **STEP 3: CENTRAL INDEX CREATION (`index.ipynb`)**

### **Cell 1: Project Overview (Markdown)**
```markdown
# 📚 [PROJECT_NAME] - Interactive Documentation Hub

[![Project](https://img.shields.io/badge/[PROJECT_NAME]-[VERSION]-[COLOR])]([PROJECT_URL])
[![Documentation](https://img.shields.io/badge/docs-live-brightgreen)]([DOCS_URL])
[![Cursor v1.0](https://img.shields.io/badge/Cursor-v1.0%20Ready-purple)](https://cursor.com/)

*Intelligent interactive documentation system for [PROJECT_NAME]*

## 🎯 **Project Overview**

[PROJECT_DESCRIPTION]

### **Key Features**
- **Feature 1** - Description
- **Feature 2** - Description  
- **Feature 3** - Description

### **Technology Stack**
- **Frontend**: [FRONTEND_TECH]
- **Backend**: [BACKEND_TECH]
- **Database**: [DATABASE_TECH]
- **Deployment**: [DEPLOYMENT_TECH]

---

## 📋 **Interactive Documentation Categories**

### 🔧 **[Category 1]**
[Description of category purpose]

### 📊 **[Category 2]** 
[Description of category purpose]

### 🎓 **[Category 3]**
[Description of category purpose]

### 🏗️ **[Category 4]**
[Description of category purpose]
```

### **Cell 2: Configuration & Setup (Python)**
```python
# Project Configuration and Environment Setup
import os
import sys
import json
import requests
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union

# Project Configuration
PROJECT_CONFIG = {
    "name": "[PROJECT_NAME]",
    "version": "[PROJECT_VERSION]", 
    "documentation_url": "[DOCS_URL]",
    "repository_url": "[REPO_URL]",
    "base_path": "[PROJECT_BASE_PATH]",
    "api_base_url": "[API_BASE_URL]",
    "environments": {
        "development": "[DEV_URL]",
        "staging": "[STAGING_URL]", 
        "production": "[PROD_URL]"
    },
    "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}

# Notebook Categories Structure (ADAPT TO PROJECT)
NOTEBOOK_STRUCTURE = {
    "[category1]": {
        "title": "🔧 [Category 1 Title]",
        "description": "[Category 1 Description]",
        "notebooks": [],
        "color": "#FF6B6B"
    },
    "[category2]": {
        "title": "📊 [Category 2 Title]", 
        "description": "[Category 2 Description]",
        "notebooks": [],
        "color": "#4ECDC4"
    },
    "[category3]": {
        "title": "🎓 [Category 3 Title]",
        "description": "[Category 3 Description]", 
        "notebooks": [],
        "color": "#45B7D1"
    },
    "[category4]": {
        "title": "🏗️ [Category 4 Title]",
        "description": "[Category 4 Description]",
        "notebooks": [],
        "color": "#96CEB4"
    }
}

# Utility Functions (ADAPT TO PROJECT APIS)
def make_api_call(endpoint: str, method: str = "GET", data: Dict = None, headers: Dict = None):
    """Standardized API call function for [PROJECT_NAME]"""
    url = f"{PROJECT_CONFIG['api_base_url']}{endpoint}"
    default_headers = {
        "Content-Type": "application/json",
        # Add project-specific auth headers
    }
    
    if headers:
        default_headers.update(headers)
    
    try:
        if method == "GET":
            response = requests.get(url, headers=default_headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=default_headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=default_headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=default_headers)
        else:
            return {"error": f"Unsupported method: {method}", "success": False}
            
        return {
            "status_code": response.status_code,
            "data": response.json() if response.content else None,
            "success": response.status_code < 400,
            "headers": dict(response.headers)
        }
    except Exception as e:
        return {"error": str(e), "success": False}

def scan_notebooks():
    """Scan the notebooks directory and populate the structure"""
    base_path = "[NOTEBOOKS_BASE_PATH]"  # Update with actual path
    
    for category, info in NOTEBOOK_STRUCTURE.items():
        category_path = os.path.join(base_path, category)
        if os.path.exists(category_path):
            notebooks = []
            for file in os.listdir(category_path):
                if file.endswith('.ipynb') and not file.startswith('.'):
                    notebooks.append({
                        "filename": file,
                        "title": file.replace('.ipynb', '').replace('-', ' ').title(),
                        "path": f"notebooks/{category}/{file}",
                        "size": os.path.getsize(os.path.join(category_path, file))
                    })
            info["notebooks"] = notebooks
    
    return NOTEBOOK_STRUCTURE

# Initialize system
notebook_structure = scan_notebooks()
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

print("✅ [PROJECT_NAME] Interactive Documentation Initialized")
print("=" * 60)
print(f"📅 Last Updated: {PROJECT_CONFIG['last_updated']}")
print(f"🌐 Project: {PROJECT_CONFIG['repository_url']}")
print(f"📚 Docs: {PROJECT_CONFIG['documentation_url']}")
print("=" * 60)
```

### **Cell 3: Live Directory Scanner (Python)**
```python
# Live Notebook Directory Display
from IPython.display import display, HTML, Markdown

def display_notebook_directory():
    """Display interactive directory of all notebooks"""
    all_notebooks = []
    for category, info in notebook_structure.items():
        for notebook in info["notebooks"]:
            all_notebooks.append({
                "Category": info["title"],
                "Notebook": notebook["title"],
                "Filename": notebook["filename"],
                "Size (KB)": round(notebook["size"] / 1024, 1),
                "Path": notebook["path"]
            })
    
    if all_notebooks:
        df = pd.DataFrame(all_notebooks)
        
        print("📊 [PROJECT_NAME] Notebook Directory")
        print("=" * 80)
        print(f"📁 Total Categories: {len([cat for cat in notebook_structure.values() if cat['notebooks']])}")
        print(f"📓 Total Notebooks: {len(all_notebooks)}")
        print(f"💾 Total Size: {sum([nb['Size (KB)'] for nb in all_notebooks]):.1f} KB")
        print("=" * 80)
        
        display(df)
    else:
        print("📝 No notebooks found. Ready to create some!")
    
    return all_notebooks

current_notebooks = display_notebook_directory()
```

### **Cell 4: Project Analytics Visualization (Python)**
```python
# Project-Specific Analytics and Visualization
import numpy as np

def create_project_documentation_overview():
    """Create visual overview of documentation ecosystem"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    fig.suptitle(f'📚 {PROJECT_CONFIG["name"]} - Documentation Ecosystem', fontsize=16, fontweight='bold')
    
    # Left plot: Category distribution
    categories = list(notebook_structure.keys())
    notebook_counts = [len(info["notebooks"]) for info in notebook_structure.values()]
    colors = [info["color"] for info in notebook_structure.values()]
    
    # Add planned notebooks (ADJUST BASED ON PROJECT SCOPE)
    planned_counts = [3, 3, 3, 3]  # Adjust per category
    
    y_pos = np.arange(len(categories))
    
    bars1 = ax1.barh(y_pos, notebook_counts, color=colors, alpha=0.8, label='Existing')
    bars2 = ax1.barh(y_pos, planned_counts, left=notebook_counts, color=colors, alpha=0.3, label='Planned')
    
    ax1.set_yticks(y_pos)
    ax1.set_yticklabels([info["title"] for info in notebook_structure.values()])
    ax1.set_xlabel('Number of Notebooks')
    ax1.set_title('📊 Notebooks by Category')
    ax1.legend()
    
    for i, (existing, planned) in enumerate(zip(notebook_counts, planned_counts)):
        total = existing + planned
        ax1.text(total + 0.1, i, f'{existing}/{total}', va='center', fontweight='bold')
    
    # Right plot: Documentation ecosystem (ADAPT TO PROJECT)
    ecosystem_data = {
        'Static Docs': 30,
        'Interactive Notebooks': 25,
        'API Documentation': 25,
        'Code Examples': 20
    }
    
    ax2.pie(
        ecosystem_data.values(),
        labels=ecosystem_data.keys(),
        autopct='%1.0f%%',
        startangle=90,
        colors=['#FF9999', '#66B3FF', '#99FF99', '#FFCC99']
    )
    
    ax2.set_title('📖 Documentation Types')
    
    plt.tight_layout()
    plt.show()
    
    print(f"📊 {PROJECT_CONFIG['name']} Documentation Analytics")
    print("=" * 60)
    print(f"📚 Documentation: {PROJECT_CONFIG['documentation_url']}")
    print(f"📓 Interactive Notebooks: {sum(notebook_counts)} existing, {sum(planned_counts)} planned")
    print(f"🔧 Key Features: {len(PROJECT_CONFIG.get('key_features', []))}")
    print(f"💻 Technology Stack: {len(PROJECT_CONFIG.get('tech_stack', []))}")
    print("=" * 60)

create_project_documentation_overview()
```

### **Cell 5: Project Roadmap (Markdown)**
```markdown
## 📑 **[PROJECT_NAME] Interactive Documentation Roadmap**

### 🔧 **[Category 1] Notebooks**

| Notebook | Description | Status | Priority |
|----------|-------------|--------|----------|
| **[Notebook 1]** | [Description] | 🔄 Planned | High |
| **[Notebook 2]** | [Description] | 🔄 Planned | Medium |
| **[Notebook 3]** | [Description] | 🔄 Planned | Low |

### 📊 **[Category 2] Notebooks**

| Notebook | Description | Status | Priority |
|----------|-------------|--------|----------|
| **[Notebook 1]** | [Description] | 🔄 Planned | High |
| **[Notebook 2]** | [Description] | 🔄 Planned | Medium |

### 🎓 **[Category 3] Notebooks**

| Notebook | Description | Status | Priority |
|----------|-------------|--------|----------|
| **[Notebook 1]** | [Description] | 🔄 Planned | High |
| **[Notebook 2]** | [Description] | 🔄 Planned | Medium |

### 🏗️ **[Category 4] Notebooks**

| Notebook | Description | Status | Priority |
|----------|-------------|--------|----------|
| **[Notebook 1]** | [Description] | 🔄 Planned | High |
| **[Notebook 2]** | [Description] | 🔄 Planned | Medium |
```

### **Cell 6: Quick Start Guide (Markdown)**
```markdown
## 🚀 **Quick Start Guide**

### **Prerequisites**
- Python 3.8+ with Jupyter Lab/Notebook
- [PROJECT_SPECIFIC_REQUIREMENTS]
- Access to [PROJECT_NAME] APIs/services

### **Setup Instructions**
```bash
# Navigate to project notebooks
cd [PROJECT_PATH]/notebooks

# Install dependencies
pip install jupyter pandas matplotlib seaborn requests [PROJECT_SPECIFIC_PACKAGES]

# Start Jupyter Lab
jupyter lab index.ipynb
```

### **Environment Configuration**
```python
# Project-specific configuration
PROJECT_API_BASE = "[DEV_API_URL]"      # Development
PROJECT_API_BASE = "[PROD_API_URL]"     # Production

# Authentication (adapt to project)
API_KEY = "your-api-key"
AUTH_TOKEN = "your-auth-token"
```

---

## 🎯 **Next Steps**

1. **Explore Project Features** - Start with [category]/[first-notebook].ipynb
2. **Set Up Environment** - Configure APIs and authentication
3. **Create Documentation** - Use templates to document your workflows
4. **Integrate** - Link notebooks from existing documentation

---

*Ready to explore [PROJECT_NAME] interactively? Let's dive in! 🚀*
```

---

## 🔧 **STEP 4: PROJECT-SPECIFIC TEMPLATE CREATION**

Create `templates/notebook-template.ipynb` customized for the project:

### **Template Structure:**
```python
# Cell 1: Title and Overview (Markdown)
# Cell 2: Setup and Configuration (Python) - Include project-specific imports
# Cell 3: Interactive Examples (Python) - Project-specific API calls/functions
# Cell 4: Visualizations (Python) - Charts relevant to project domain
# Cell 5: Integration Examples (Markdown + Python) - Real project integration
# Cell 6: Best Practices (Markdown) - Project-specific guidelines
# Cell 7: Next Steps (Markdown) - Links to related notebooks/docs
```

---

## 📖 **STEP 5: INTEGRATION STRATEGY**

### **A. Documentation System Integration**

**For Docusaurus projects:**
```jsx
// Create NotebookLink component
import React from 'react';

interface NotebookLinkProps {
  notebook: string;
  title: string; 
  description?: string;
  category?: string;
}

export default function NotebookLink({ notebook, title, description, category }: NotebookLinkProps) {
  // Component implementation
}
```

**For GitBook/MkDocs/Sphinx:**
```markdown
<!-- Embed notebook links -->
[![Interactive Notebook](https://img.shields.io/badge/Jupyter-Interactive-orange)](./notebooks/category/notebook.ipynb)
```

### **B. CI/CD Integration**
```yaml
# Add to GitHub Actions or CI/CD pipeline
- name: Validate Notebooks
  run: |
    jupyter nbconvert --execute --to notebook notebooks/**/*.ipynb
    jupyter nbconvert --to html notebooks/index.ipynb
```

---

## 🎯 **STEP 6: PROJECT ADAPTATION CHECKLIST**

### **Pre-Creation Analysis:**
- [ ] Identify project technology stack
- [ ] Map existing documentation structure  
- [ ] Determine relevant notebook categories
- [ ] List key APIs and services to document
- [ ] Identify integration points with existing docs

### **Content Creation:**
- [ ] Create project-specific configuration
- [ ] Adapt notebook categories to project needs
- [ ] Build relevant visualization functions
- [ ] Create project-specific templates
- [ ] Establish naming conventions

### **Integration:**
- [ ] Link from existing documentation
- [ ] Create project-specific components if needed
- [ ] Set up CI/CD validation
- [ ] Establish contribution guidelines
- [ ] Plan maintenance schedule

---

## 🚀 **EXECUTION PROMPT FOR AI AGENTS**

```
TASK: Create an intelligent Jupyter notebook documentation system for [PROJECT_NAME]

CONTEXT: Analyze the project at [PROJECT_PATH] and create an interactive documentation hub optimized for AI agent interaction and developer productivity.

STEPS:
1. Scan project structure and identify technology stack
2. Determine 3-4 relevant documentation categories
3. Create notebooks/ directory with proper structure
4. Generate central index.ipynb with live scanning capabilities
5. Create project-specific templates and configuration
6. Integrate with existing documentation system
7. Establish development workflow and guidelines

OUTPUT: Complete interactive documentation system with:
- Central intelligence hub (index.ipynb)
- Project-specific categories and structure
- Templates for consistent development
- Integration with existing docs
- Strategic roadmap for expansion

OPTIMIZATION: Ensure compatibility with Cursor IDE, AI agent interaction, and autonomous development workflows.
```

---

## 📊 **SUCCESS METRICS**

- **📋 Central Hub**: Functional index.ipynb with live directory scanning
- **🏗️ Structure**: Logical category organization adapted to project
- **🔗 Integration**: Seamless connection with existing documentation
- **📝 Templates**: Standardized notebook creation process
- **🤖 AI-Ready**: Optimized for autonomous agent interaction
- **📈 Scalable**: Room for growth and easy maintenance

---

*This prompt enables any AI agent to create sophisticated, project-adapted interactive documentation systems that serve as intelligent knowledge hubs for development teams.*