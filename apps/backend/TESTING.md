# Testing Documentation

## Test Files Created

### 1. BaseService Tests (`src/common/services/base.service.spec.ts`)

Comprehensive test suite for the `BaseService` class covering:

#### Error Handling (`handlePrismaError`)
- ✅ Successful operations return results
- ✅ P2002 (unique constraint) → BadRequestException
- ✅ P2025 (record not found) → NotFoundException
- ✅ P2003 (foreign key constraint) → BadRequestException
- ✅ Unknown errors are rethrown and logged
- ✅ Error messages include field names when available

#### Pagination (`paginate`)
- ✅ Correct pagination structure
- ✅ Skip calculation for different pages
- ✅ PageCount calculation (including partial last pages)
- ✅ Empty results handling
- ✅ OrderBy, include, and select options
- ✅ Transaction usage for count and findMany

#### Logger Initialization
- ✅ Logger is properly initialized with service name

### 2. QueryBuilder Tests (`src/common/utils/query-builder.util.spec.ts`)

Comprehensive test suite for the `QueryBuilder` utility covering:

#### Basic Filtering
- ✅ Empty filters handling
- ✅ Ignoring undefined, null, and empty strings
- ✅ Excluding pagination/sorting fields
- ✅ Exact match for string values
- ✅ Boolean filters
- ✅ Array filters with "in" operator
- ✅ Empty array handling

#### Search Functionality
- ✅ OR condition building for multiple fields
- ✅ Case-insensitive search mode
- ✅ Empty search handling
- ✅ Empty fields array handling

#### Date Handling
- ✅ Date field conversion to Date objects
- ✅ Auto-detection of fields ending with "Date"
- ✅ Auto-detection of fields ending with "At"
- ✅ Date range with "After" suffix (gte)
- ✅ Date range with "Before" suffix (lte)
- ✅ Combining "After" and "Before" for same field
- ✅ Date ranges with field mappings

#### Field Mappings
- ✅ Mapping filter fields to database fields
- ✅ Using original field name if not in mappings
- ✅ Nested field mappings with date ranges

#### Complex Scenarios
- ✅ Multiple filter types together
- ✅ Nested field mappings with date ranges

#### Search Condition Builder
- ✅ Empty search returns empty object
- ✅ Null search handling
- ✅ Empty fields array handling
- ✅ OR condition building
- ✅ Case-insensitive mode

#### Sort Field Validation
- ✅ Undefined sortBy handling
- ✅ Valid sort field acceptance
- ✅ Invalid sort field error throwing
- ✅ Error message includes allowed fields
- ✅ Single allowed field handling

## Running Tests

### Run All Tests
```bash
cd apps/backend
npm test
```

### Run Specific Test File
```bash
npm test base.service.spec
npm test query-builder.util.spec
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:cov
```

### Run Tests from Root
```bash
npm test --workspace=apps/backend
```

## Test Coverage

The test suites provide comprehensive coverage for:

1. **BaseService** - All public and protected methods
2. **QueryBuilder** - All static methods and edge cases
3. **Error Scenarios** - All Prisma error codes handled
4. **Edge Cases** - Empty data, null values, boundary conditions
5. **Integration Points** - Prisma transaction usage, logger integration

## Test Structure

Tests follow NestJS testing best practices:
- Uses `@nestjs/testing` for dependency injection
- Mocks PrismaService for isolation
- Tests are organized by method/feature
- Clear test descriptions
- Comprehensive edge case coverage

## Adding New Tests

When adding new functionality to BaseService or QueryBuilder:

1. Add corresponding test cases
2. Test both success and error scenarios
3. Include edge cases (empty, null, boundary values)
4. Update this documentation

## Continuous Integration

These tests should be run in CI/CD pipelines to ensure:
- Code quality
- Regression prevention
- Documentation accuracy
- Refactoring safety

