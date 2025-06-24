# 🚀 Quick Deploy: Interactive Documentation System

*Rapid deployment prompt for AI agents to create Jupyter notebook documentation hubs*

## 🎯 **MISSION**
Create an intelligent Jupyter notebook documentation system for `[PROJECT_NAME]` that serves as an AI-agent-optimized knowledge hub with live code execution and seamless existing documentation integration.

## ⚡ **RAPID EXECUTION STEPS**

### **1. Project Analysis (2 minutes)**
```bash
# Analyze: Tech stack, APIs, existing docs, project structure
# Determine: 3-4 relevant categories based on project type
# Document: Key features, environments, integration points
```

### **2. Structure Creation (3 minutes)**
```bash
mkdir -p notebooks/{api-testing,analytics,tutorials,architecture,templates,completed,archive}
touch notebooks/{index.ipynb,README.md}
```

### **3. Central Hub (`index.ipynb`) - 6 cells**

**Cell 1 (Markdown):**
```markdown
# 📚 [PROJECT_NAME] - Interactive Documentation Hub
[![Project](https://img.shields.io/badge/[PROJECT]-[VERSION]-blue)]([URL])
[![Cursor v1.0](https://img.shields.io/badge/Cursor-v1.0%20Ready-purple)](https://cursor.com/)

*AI-optimized interactive documentation for [PROJECT_NAME]*

## 🎯 **Project Overview**
- **Tech Stack**: [STACK]
- **Key Features**: [FEATURES]
- **Documentation**: [DOCS_URL]
```

**Cell 2 (Python):**
```python
import os, sys, json, requests, pandas as pd, matplotlib.pyplot as plt, seaborn as sns
from datetime import datetime
from typing import Dict, List, Optional

PROJECT_CONFIG = {
    "name": "[PROJECT_NAME]", "version": "[VERSION]", 
    "api_base_url": "[API_URL]", "repo_url": "[REPO_URL]",
    "environments": {"dev": "[DEV_URL]", "prod": "[PROD_URL]"}
}

def make_api_call(endpoint, method="GET", data=None):
    """Project-specific API helper"""
    # Implement based on project auth/structure

def scan_notebooks():
    """Live directory scanner"""
    # Implementation for dynamic notebook discovery

notebook_structure = scan_notebooks()
print(f"✅ {PROJECT_CONFIG['name']} Documentation Hub Initialized")
```

**Cell 3 (Python):**
```python
# Live Notebook Directory & Analytics
def display_project_overview():
    # Project-specific dashboard with charts and metrics
    # Notebook catalog, progress tracking, ecosystem overview

display_project_overview()
```

**Cell 4-6 (Markdown):**
```markdown
## 📑 **Documentation Roadmap**
[Project-specific notebook catalog with priorities]

## 🚀 **Quick Start**
[Setup instructions and first steps]

## 🔗 **Integration**
[Links to existing docs and related resources]
```

### **4. Integration (2 minutes)**
- Create `NotebookLink` React component if Docusaurus project
- Add notebook references to existing documentation
- Set up basic CI/CD validation

### **5. Templates (3 minutes)**
- Copy `notebook-template.ipynb` and customize for project
- Adapt configuration, imports, and examples
- Establish naming conventions and structure

## 🎯 **PROJECT TYPE ADAPTATIONS**

### **Web Application**
Categories: `api-testing/`, `frontend/`, `backend/`, `deployment/`
Focus: API endpoints, UI components, database operations

### **Data Science/ML Project**  
Categories: `data-analysis/`, `modeling/`, `pipelines/`, `experiments/`
Focus: Dataset exploration, model training, pipeline automation

### **Mobile Application**
Categories: `api-testing/`, `ui-components/`, `native-features/`, `deployment/`
Focus: API integration, component testing, platform-specific features

### **DevOps/Infrastructure**
Categories: `infrastructure/`, `monitoring/`, `deployments/`, `automation/`
Focus: Infrastructure as code, metrics, CI/CD, automation scripts

### **Library/SDK**
Categories: `api-documentation/`, `examples/`, `tutorials/`, `testing/`
Focus: Usage examples, integration guides, comprehensive testing

## 🔧 **ESSENTIAL INTEGRATIONS**

### **Docusaurus Integration**
```jsx
// src/components/NotebookLink.tsx
import React from 'react';
export default function NotebookLink({notebook, title, description, category}) {
  return (
    <div className="notebook-link">
      <a href={`./notebooks/${category}/${notebook}`}>{title}</a>
    </div>
  );
}
```

### **Documentation Pages**
```markdown
import NotebookLink from '@site/src/components/NotebookLink';

<NotebookLink 
  notebook="feature-testing.ipynb"
  title="Interactive Feature Testing"
  description="Live testing and exploration of key features"
  category="api-testing"
/>
```

## ✅ **SUCCESS CHECKLIST**

- [ ] **Central Hub**: Functional `index.ipynb` with live scanning
- [ ] **Project Config**: Adapted to actual project URLs, APIs, tech stack  
- [ ] **Categories**: 3-4 relevant categories based on project type
- [ ] **Integration**: Connected to existing documentation system
- [ ] **Template**: Project-specific notebook template ready
- [ ] **Navigation**: Clear paths between static and interactive docs

## 🚀 **DEPLOYMENT COMMAND**

```bash
# One-line deployment for AI agents
AI_TASK="Create interactive documentation hub for PROJECT_NAME at PROJECT_PATH with categories: [CATS] and integration with [DOC_SYSTEM]"
```

---

**🎯 Total Time: ~15 minutes | Result: Production-ready interactive documentation system optimized for AI agent development workflows** 