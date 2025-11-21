import { QueryBuilder } from './query-builder.util';
import { Prisma } from '@prisma/client';

describe('QueryBuilder', () => {
  describe('buildWhereClause', () => {
    it('should return empty object for empty filters', () => {
      const result = QueryBuilder.buildWhereClause<any>({});
      expect(result).toEqual({});
    });

    it('should ignore undefined, null, and empty string values', () => {
      const filters = {
        name: undefined,
        email: null,
        status: '',
        validField: 'value',
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({ validField: 'value' });
    });

    it('should exclude pagination and sorting fields', () => {
      const filters = {
        page: 1,
        pageSize: 25,
        sortBy: 'name',
        sortOrder: 'desc',
        skip: 0,
        take: 10,
        status: 'active',
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({ status: 'active' });
      expect(result.page).toBeUndefined();
      expect(result.pageSize).toBeUndefined();
      expect(result.sortBy).toBeUndefined();
    });

    it('should handle exact match for string values', () => {
      const filters = {
        status: 'active',
        type: 'premium',
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({
        status: 'active',
        type: 'premium',
      });
    });

    it('should handle boolean filters', () => {
      const filters = {
        isActive: true,
        isDeleted: false,
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({
        isActive: true,
        isDeleted: false,
      });
    });

    it('should handle array filters with "in" operator', () => {
      const filters = {
        ids: ['1', '2', '3'],
        statuses: ['active', 'pending'],
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({
        ids: { in: ['1', '2', '3'] },
        statuses: { in: ['active', 'pending'] },
      });
    });

    it('should ignore empty arrays', () => {
      const filters = {
        ids: [],
        status: 'active',
      };

      const result = QueryBuilder.buildWhereClause<any>(filters);
      expect(result).toEqual({ status: 'active' });
      expect(result.ids).toBeUndefined();
    });

    describe('search functionality', () => {
      it('should build OR condition for search with multiple fields', () => {
        const filters = {
          search: 'john',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          searchFields: ['firstName', 'lastName', 'email'],
        });

        expect(result.OR).toHaveLength(3);
        expect(result.OR).toEqual([
          {
            firstName: {
              contains: 'john',
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            lastName: {
              contains: 'john',
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            email: {
              contains: 'john',
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ]);
      });

      it('should not add search if searchFields is empty', () => {
        const filters = {
          search: 'test',
          status: 'active',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          searchFields: [],
        });

        expect(result.OR).toBeUndefined();
        expect(result.status).toBe('active');
      });

      it('should not add search if search key is not present', () => {
        const filters = {
          status: 'active',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          searchFields: ['name'],
        });

        expect(result.OR).toBeUndefined();
      });
    });

    describe('date fields', () => {
      it('should convert date fields to Date objects', () => {
        const dateString = '2024-01-15';
        const filters = {
          createdAt: dateString,
          updatedAt: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          dateFields: ['createdAt', 'updatedAt'],
        });

        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });

      it('should auto-detect date fields ending with "Date"', () => {
        const filters = {
          startDate: '2024-01-15',
          endDate: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters);

        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.endDate).toBeInstanceOf(Date);
      });

      it('should auto-detect date fields ending with "At"', () => {
        const filters = {
          createdAt: '2024-01-15',
          updatedAt: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters);

        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('date range fields', () => {
      it('should handle "After" suffix for date ranges', () => {
        const filters = {
          createdAtAfter: '2024-01-15',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters);

        expect(result.createdAt).toBeDefined();
        expect(result.createdAt.gte).toBeInstanceOf(Date);
        expect(result.createdAt.lte).toBeUndefined();
      });

      it('should handle "Before" suffix for date ranges', () => {
        const filters = {
          createdAtBefore: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters);

        expect(result.createdAt).toBeDefined();
        expect(result.createdAt.lte).toBeInstanceOf(Date);
        expect(result.createdAt.gte).toBeUndefined();
      });

      it('should combine "After" and "Before" for same field', () => {
        const filters = {
          createdAtAfter: '2024-01-15',
          createdAtBefore: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters);

        expect(result.createdAt).toBeDefined();
        expect(result.createdAt.gte).toBeInstanceOf(Date);
        expect(result.createdAt.lte).toBeInstanceOf(Date);
      });

      it('should handle date range with field mappings', () => {
        const filters = {
          startDateAfter: '2024-01-15',
          startDateBefore: '2024-01-20',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          fieldMappings: { startDate: 'start_date' },
        });

        expect(result.start_date).toBeDefined();
        expect(result.start_date.gte).toBeInstanceOf(Date);
        expect(result.start_date.lte).toBeInstanceOf(Date);
      });
    });

    describe('field mappings', () => {
      it('should map filter fields to database fields', () => {
        const filters = {
          customerId: '123',
          userId: '456',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          fieldMappings: {
            customerId: 'customer.id',
            userId: 'user.id',
          },
        });

        expect(result['customer.id']).toBe('123');
        expect(result['user.id']).toBe('456');
        expect(result.customerId).toBeUndefined();
        expect(result.userId).toBeUndefined();
      });

      it('should use original field name if not in mappings', () => {
        const filters = {
          status: 'active',
          name: 'test',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          fieldMappings: {
            status: 'status_code',
          },
        });

        expect(result['status_code']).toBe('active');
        expect(result.name).toBe('test');
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple filter types together', () => {
        const filters = {
          search: 'john',
          status: 'active',
          isActive: true,
          ids: ['1', '2'],
          createdAtAfter: '2024-01-01',
          page: 1,
          pageSize: 25,
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          searchFields: ['firstName', 'lastName'],
        });

        expect(result.OR).toBeDefined();
        expect(result.status).toBe('active');
        expect(result.isActive).toBe(true);
        expect(result.ids).toEqual({ in: ['1', '2'] });
        expect(result.createdAt).toBeDefined();
        expect(result.createdAt.gte).toBeInstanceOf(Date);
        expect(result.page).toBeUndefined();
        expect(result.pageSize).toBeUndefined();
      });

      it('should handle nested field mappings with date ranges', () => {
        const filters = {
          customerId: '123',
          orderDateAfter: '2024-01-01',
          orderDateBefore: '2024-01-31',
        };

        const result = QueryBuilder.buildWhereClause<any>(filters, {
          fieldMappings: {
            customerId: 'customer.id',
            orderDate: 'order.date',
          },
        });

        expect(result['customer.id']).toBe('123');
        expect(result['order.date']).toBeDefined();
        expect(result['order.date'].gte).toBeInstanceOf(Date);
        expect(result['order.date'].lte).toBeInstanceOf(Date);
      });
    });
  });

  describe('buildSearchCondition', () => {
    it('should return empty object for empty search', () => {
      const result = QueryBuilder.buildSearchCondition('', ['name', 'email']);
      expect(result).toEqual({});
    });

    it('should return empty object for null search', () => {
      const result = QueryBuilder.buildSearchCondition(null as any, [
        'name',
        'email',
      ]);
      expect(result).toEqual({});
    });

    it('should return empty object for empty fields array', () => {
      const result = QueryBuilder.buildSearchCondition('test', []);
      expect(result).toEqual({});
    });

    it('should build OR condition for search', () => {
      const result = QueryBuilder.buildSearchCondition('john', [
        'firstName',
        'lastName',
        'email',
      ]);

      expect(result.OR).toHaveLength(3);
      expect(result.OR).toEqual([
        {
          firstName: {
            contains: 'john',
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          lastName: {
            contains: 'john',
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: 'john',
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ]);
    });

    it('should use case-insensitive search mode', () => {
      const result = QueryBuilder.buildSearchCondition('TEST', ['name']);

      expect(result.OR[0].name.mode).toBe(Prisma.QueryMode.insensitive);
    });
  });

  describe('validateSortField', () => {
    it('should not throw for undefined sortBy', () => {
      expect(() => {
        QueryBuilder.validateSortField(undefined, ['name', 'email']);
      }).not.toThrow();
    });

    it('should not throw for valid sort field', () => {
      expect(() => {
        QueryBuilder.validateSortField('name', ['name', 'email', 'createdAt']);
      }).not.toThrow();
    });

    it('should throw error for invalid sort field', () => {
      expect(() => {
        QueryBuilder.validateSortField('invalidField', [
          'name',
          'email',
          'createdAt',
        ]);
      }).toThrow('Unsupported sort field: invalidField');
    });

    it('should include allowed fields in error message', () => {
      try {
        QueryBuilder.validateSortField('badField', ['name', 'email']);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('badField');
        expect(error.message).toContain('Allowed: name, email');
      }
    });

    it('should handle single allowed field', () => {
      expect(() => {
        QueryBuilder.validateSortField('name', ['name']);
      }).not.toThrow();

      expect(() => {
        QueryBuilder.validateSortField('email', ['name']);
      }).toThrow();
    });
  });
});

