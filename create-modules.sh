#!/bin/bash

# Script to create skeletal NestJS module structure for all remaining modules
# This creates the basic file structure - implementation details should follow the IMPLEMENTATION_GUIDE.md

set -e

echo "🏗️  Creating module scaffolding for D5 Management System..."
echo ""

cd apps/backend/src/modules

# Function to create module structure
create_module() {
    local module_path=$1
    local module_name=$2
    
    echo "Creating $module_name..."
    
    mkdir -p "$module_path"
    mkdir -p "$module_path/dto"
    
    # Module file
    cat > "$module_path/${module_name}.module.ts" << EOF
import { Module } from '@nestjs/common';
import { ${module_name^}Service } from './${module_name}.service';
import { ${module_name^}Controller } from './${module_name}.controller';

@Module({
  controllers: [${module_name^}Controller],
  providers: [${module_name^}Service],
  exports: [${module_name^}Service],
})
export class ${module_name^}Module {}
EOF

    # Service file
    cat > "$module_path/${module_name}.service.ts" << EOF
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ${module_name^}Service {
  constructor(private prisma: PrismaService) {}

  // TODO: Implement service methods following IMPLEMENTATION_GUIDE.md
}
EOF

    # Controller file
    cat > "$module_path/${module_name}.controller.ts" << EOF
import { Controller } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ${module_name^}Service } from './${module_name}.service';

@ApiTags('${module_name^}')
@ApiBearerAuth()
@Controller('${module_name}')
export class ${module_name^}Controller {
  constructor(private readonly ${module_name}Service: ${module_name^}Service) {}

  // TODO: Implement controller endpoints following IMPLEMENTATION_GUIDE.md
}
EOF

    echo "✅ $module_name created"
}

# CRM Modules
create_module "crm/customers" "customers"
create_module "crm/leads" "leads"
create_module "crm/opportunities" "opportunities"
create_module "crm/campaigns" "campaigns"

# Recruitment Modules
create_module "recruitment/candidates" "candidates"
create_module "recruitment/positions" "positions"

# Employee/HR Modules  
create_module "employees" "employees"
create_module "employees/leave-requests" "leave-requests"
create_module "employees/performance-reviews" "performance-reviews"
create_module "employees/eod-reports" "eod-reports"

# Other Modules
create_module "invoices" "invoices"
create_module "tasks" "tasks"
create_module "activities" "activities"
create_module "notifications" "notifications"
create_module "meetings" "meetings"
create_module "reports" "reports"
create_module "templates" "templates"
create_module "imports" "imports"
create_module "integrations" "integrations"

echo ""
echo "✅ All module scaffolding created!"
echo ""
echo "📋 Next steps:"
echo "1. Review IMPLEMENTATION_GUIDE.md for detailed implementation requirements"
echo "2. Implement service methods for each module"
echo "3. Add DTOs for validation"
echo "4. Implement controller endpoints with proper guards and decorators"
echo "5. Add proper error handling and logging"
echo ""

