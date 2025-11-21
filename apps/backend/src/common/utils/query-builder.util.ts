import { Prisma } from '@prisma/client';

export class QueryBuilder {
  /**
   * Builds a Prisma where clause from filter DTO
   * Handles common patterns like date ranges, search, and field mappings
   */
  static buildWhereClause<T>(
    filters: Record<string, any>,
    options?: {
      fieldMappings?: Record<string, string>;
      searchFields?: string[];
      dateFields?: string[];
    }
  ): T {
    const where: any = {};
    const { fieldMappings = {}, searchFields = [], dateFields = [] } = options || {};
    
    // Fields to exclude from where clause (pagination and sorting)
    const excludedFields = ['page', 'pageSize', 'sortBy', 'sortOrder', 'skip', 'take'];
    
    for (const [key, value] of Object.entries(filters)) {
      // Skip pagination and sorting fields
      if (excludedFields.includes(key)) continue;
      
      if (value === undefined || value === null || value === '') continue;
      
      // Skip empty arrays
      if (Array.isArray(value) && value.length === 0) continue;
      
      const dbField = fieldMappings[key] || key;
      
      // Handle search fields
      if (key === 'search' && searchFields.length > 0) {
        where.OR = searchFields.map(field => ({
          [field]: {
            contains: value,
            mode: Prisma.QueryMode.insensitive,
          },
        }));
        continue;
      }
      
      // Handle date range fields (ends with 'After' or 'Before')
      if (key.endsWith('After') || key.endsWith('Before')) {
        const baseField = key.replace(/After|Before$/, '');
        const dateField = fieldMappings[baseField] || baseField;
        
        if (!where[dateField]) {
          where[dateField] = {};
        }
        
        if (key.endsWith('After')) {
          where[dateField].gte = new Date(value);
        } else {
          where[dateField].lte = new Date(value);
        }
        continue;
      }
      
      // Handle date fields
      if (dateFields.includes(key) || key.endsWith('Date') || key.endsWith('At')) {
        where[dbField] = new Date(value);
        continue;
      }
      
      // Handle array filters (e.g., IDs)
      if (Array.isArray(value) && value.length > 0) {
        where[dbField] = { in: value };
        continue;
      }
      
      // Handle boolean filters
      if (typeof value === 'boolean') {
        where[dbField] = value;
        continue;
      }
      
      // Default: exact match
      where[dbField] = value;
    }
    
    return where;
  }

  /**
   * Builds search condition for multiple fields
   */
  static buildSearchCondition(search: string | null | undefined, fields: string[]): any {
    if (!search || !fields.length) return {};
    
    return {
      OR: fields.map(field => ({
        [field]: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      })),
    };
  }

  /**
   * Validates sort field against allowed fields
   */
  static validateSortField(sortBy: string | undefined, allowedFields: string[]): void {
    if (!sortBy) return;
    
    if (!allowedFields.includes(sortBy)) {
      throw new Error(`Unsupported sort field: ${sortBy}. Allowed: ${allowedFields.join(', ')}`);
    }
  }
}

