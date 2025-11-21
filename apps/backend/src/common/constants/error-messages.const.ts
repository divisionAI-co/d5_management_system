/**
 * Standardized error messages across the application
 * Use these constants to ensure consistent error messaging
 */
export const ErrorMessages = {
  /**
   * Not found errors
   */
  NOT_FOUND: (entity: string, id: string) => `${entity} with ID ${id} not found`,
  NOT_FOUND_BY_FIELD: (entity: string, field: string, value: string) =>
    `${entity} with ${field} '${value}' not found`,
  
  /**
   * Already exists errors
   */
  ALREADY_EXISTS: (entity: string, field: string) =>
    `${entity} with this ${field} already exists`,
  
  /**
   * Operation failed errors
   */
  CREATE_FAILED: (entity: string) => `Failed to create ${entity}`,
  UPDATE_FAILED: (entity: string) => `Failed to update ${entity}`,
  DELETE_FAILED: (entity: string) => `Failed to delete ${entity}`,
  FETCH_FAILED: (entity: string) => `Failed to fetch ${entity}`,
  
  /**
   * Validation errors
   */
  INVALID_INPUT: (field: string, reason?: string) =>
    `Invalid ${field}${reason ? `: ${reason}` : ''}`,
  MISSING_REQUIRED_FIELD: (field: string) => `Missing required field: ${field}`,
  
  /**
   * Business logic errors
   */
  OPERATION_NOT_ALLOWED: (operation: string, reason?: string) =>
    `Operation '${operation}' is not allowed${reason ? `: ${reason}` : ''}`,
  INVALID_STATUS_TRANSITION: (from: string, to: string) =>
    `Cannot change status from '${from}' to '${to}'`,
  
  /**
   * Permission errors
   */
  UNAUTHORIZED: (action: string) => `Unauthorized to ${action}`,
  FORBIDDEN: (resource: string) => `Access forbidden to ${resource}`,
} as const;

