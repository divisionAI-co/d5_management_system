#!/bin/bash

# Script to create placeholder page components for the frontend

set -e

echo "🎨 Creating frontend page scaffolding..."
echo ""

cd apps/frontend/src/pages

# Function to create a placeholder page
create_page() {
    local dir=$1
    local filename=$2
    local title=$3
    
    mkdir -p "$dir"
    
    cat > "$dir/$filename" << EOF
export default function ${filename%.tsx}() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">$title</h1>
      <p className="text-gray-600">
        This page is under construction. See IMPLEMENTATION_GUIDE.md for implementation details.
      </p>
    </div>
  );
}
EOF
    
    echo "✅ Created $dir/$filename"
}

# CRM Pages
create_page "crm" "CustomersPage.tsx" "Customers"
create_page "crm" "CustomerDetailPage.tsx" "Customer Details"
create_page "crm" "LeadsPage.tsx" "Leads Pipeline"
create_page "crm" "OpportunitiesPage.tsx" "Opportunities"
create_page "crm" "CampaignsPage.tsx" "Email Campaigns"

# Recruitment Pages
create_page "recruitment" "CandidatesPage.tsx" "Candidates"
create_page "recruitment" "CandidateDetailPage.tsx" "Candidate Profile"
create_page "recruitment" "OpenPositionsPage.tsx" "Open Positions"

# Employee Pages
create_page "employees" "EmployeesPage.tsx" "Employees"
create_page "employees" "EmployeeDetailPage.tsx" "Employee Profile"
create_page "employees" "EodReportsPage.tsx" "End-of-Day Reports"
create_page "employees" "LeaveRequestsPage.tsx" "Leave Requests"

# Task Pages
create_page "tasks" "TasksPage.tsx" "Task Board"

# Invoice Pages
create_page "invoices" "InvoicesPage.tsx" "Invoices"
create_page "invoices" "InvoiceDetailPage.tsx" "Invoice Details"

# Settings Pages
create_page "settings" "SettingsPage.tsx" "Settings"

echo ""
echo "✅ All frontend pages created!"
echo ""

