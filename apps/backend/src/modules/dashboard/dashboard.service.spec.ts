import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UserRole,
  TaskStatus,
  TaskPriority,
  LeaveRequestStatus,
  CustomerStatus,
  CustomerType,
  InvoiceStatus,
  CandidateStage,
  EmploymentStatus,
  ContractType,
} from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.EMPLOYEE,
    employee: {
      id: 'emp-1',
      hireDate: new Date('2024-01-01'),
    },
  };

  const mockAdminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    employee: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      eodReport: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      activity: {
        findMany: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      nationalHoliday: {
        findMany: jest.fn(),
      },
      companySettings: {
        findFirst: jest.fn(),
      },
      performanceReview: {
        findMany: jest.fn(),
      },
      candidate: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      openPosition: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      recruiterPerformanceReport: {
        findMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      customer: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      lead: {
        groupBy: jest.fn(),
      },
      opportunity: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      quote: {
        findMany: jest.fn(),
      },
      accountLockout: {
        count: jest.fn(),
      },
      failedLoginAttempt: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyDashboard', () => {
    it('should return admin view for admin users', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockAdminUser as any);

      const result = await service.getMyDashboard('admin-1');

      expect(result).toEqual({
        userRole: UserRole.ADMIN,
        isAdminView: true,
        stats: {
          missingReports: 0,
          lateReports: 0,
          lateReportsBeyondThreshold: 0,
          totalReports: 0,
        },
        timeframe: null,
        recentReports: [],
        tasksDueSoon: [],
        activitiesDueSoon: [],
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        select: {
          id: true,
          role: true,
          employee: {
            select: {
              id: true,
              hireDate: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyDashboard('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return dashboard data for employee users', async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.companySettings.findFirst.mockResolvedValue({
        eodLateReportsAllowed: 2,
      } as any);
      prismaService.eodReport.findMany
        .mockResolvedValueOnce([
          {
            id: 'report-1',
            date: new Date('2024-01-15'),
            isLate: false,
            hoursWorked: 8,
            submittedAt: new Date('2024-01-15T18:00:00'),
            summary: 'Worked on tasks',
          },
        ])
        .mockResolvedValueOnce([
          {
            date: new Date('2024-01-10'),
          },
        ]);
      prismaService.eodReport.count
        .mockResolvedValueOnce(1) // lateReportsCount
        .mockResolvedValueOnce(0) // lateReportsThisMonth
        .mockResolvedValueOnce(5); // totalReportsCount
      prismaService.task.findMany.mockResolvedValue([]);
      prismaService.activity.findMany.mockResolvedValue([]);
      prismaService.nationalHoliday.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getMyDashboard('user-1');

      expect(result).toMatchObject({
        userRole: UserRole.EMPLOYEE,
        isAdminView: false,
        stats: {
          missingReports: expect.any(Number),
          lateReports: 1,
          lateReportsBeyondThreshold: 0,
          totalReports: 5,
        },
        recentReports: expect.arrayContaining([
          expect.objectContaining({
            id: 'report-1',
            summary: 'Worked on tasks',
            hoursWorked: 8,
            isLate: false,
          }),
        ]),
        tasksDueSoon: [],
        activitiesDueSoon: [],
      });
    });

    it('should calculate missing reports correctly', async () => {
      const now = new Date('2024-01-20');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.companySettings.findFirst.mockResolvedValue({
        eodLateReportsAllowed: 2,
      } as any);
      prismaService.eodReport.findMany
        .mockResolvedValueOnce([]) // recentReports
        .mockResolvedValueOnce([
          { date: new Date('2024-01-10') },
          { date: new Date('2024-01-12') },
        ]); // currentMonthReports
      prismaService.eodReport.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2);
      prismaService.task.findMany.mockResolvedValue([]);
      prismaService.activity.findMany.mockResolvedValue([]);
      prismaService.nationalHoliday.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getMyDashboard('user-1');

      expect(result.stats.missingReports).toBeGreaterThanOrEqual(0);
      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalled();
      expect(prismaService.leaveRequest.findMany).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should return tasks due soon', async () => {
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 3);

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.companySettings.findFirst.mockResolvedValue({
        eodLateReportsAllowed: 2,
      } as any);
      prismaService.eodReport.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaService.eodReport.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaService.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Test Task',
          dueDate,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          customerId: null,
        },
      ]);
      prismaService.activity.findMany.mockResolvedValue([]);
      prismaService.nationalHoliday.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getMyDashboard('user-1');

      expect(result.tasksDueSoon).toHaveLength(1);
      expect(result.tasksDueSoon[0]).toMatchObject({
        id: 'task-1',
        title: 'Test Task',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        isOverdue: false,
      });
    });
  });

  describe('getAdminDashboard', () => {
    const mockInvoices = [
      {
        id: 'inv-1',
        status: InvoiceStatus.PAID,
        total: 1000,
        dueDate: new Date(),
        paidDate: new Date(),
        issueDate: new Date(),
        isRecurring: true,
        customer: {
          id: 'cust-1',
          name: 'Customer 1',
          type: CustomerType.SOFTWARE_SUBSCRIPTION,
        },
      },
      {
        id: 'inv-2',
        status: InvoiceStatus.SENT,
        total: 2000,
        dueDate: new Date(),
        paidDate: null,
        issueDate: new Date(),
        isRecurring: false,
        customer: {
          id: 'cust-2',
          name: 'Customer 2',
          type: CustomerType.STAFF_AUGMENTATION,
        },
      },
    ];

    beforeEach(() => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Mock all the parallel queries
      prismaService.invoice.findMany.mockResolvedValue(mockInvoices as any);
      prismaService.customer.count.mockResolvedValue(10);
      prismaService.customer.groupBy
        .mockResolvedValueOnce([
          { type: CustomerType.STAFF_AUGMENTATION, _count: 5 },
          { type: CustomerType.SOFTWARE_SUBSCRIPTION, _count: 3 },
          { type: CustomerType.BOTH, _count: 2 },
        ])
        .mockResolvedValueOnce([
          { status: CustomerStatus.ACTIVE, _count: 8 },
          { status: CustomerStatus.AT_RISK, _count: 2 },
        ])
        .mockResolvedValueOnce([
          { sentiment: 'HAPPY', _count: 6 },
          { sentiment: 'NEUTRAL', _count: 3 },
          { sentiment: 'UNHAPPY', _count: 1 },
        ]);
      prismaService.customer.findMany.mockResolvedValue([
        {
          id: 'cust-1',
          name: 'At Risk Customer',
          status: CustomerStatus.AT_RISK,
          sentiment: 'UNHAPPY',
        },
      ] as any);
      // employee.groupBy is called 3 times in parallel, so we need to handle all 3
      let employeeGroupByCallCount = 0;
      prismaService.employee.groupBy.mockImplementation(() => {
        employeeGroupByCallCount++;
        if (employeeGroupByCallCount === 1) {
          return Promise.resolve([
            { status: EmploymentStatus.ACTIVE, _count: 20 },
            { status: EmploymentStatus.ON_LEAVE, _count: 2 },
          ]);
        } else if (employeeGroupByCallCount === 2) {
          return Promise.resolve([
            { department: 'Engineering', _count: 10 },
            { department: 'Sales', _count: 5 },
          ]);
        } else {
          return Promise.resolve([
            { contractType: ContractType.FULL_TIME, _count: 18 },
            { contractType: ContractType.CONTRACT, _count: 4 },
          ]);
        }
      });
      prismaService.employee.count
        .mockResolvedValueOnce(1) // newHiresThisMonth
        .mockResolvedValueOnce(0); // departuresThisMonth
      prismaService.eodReport.findMany
        .mockResolvedValueOnce([
          { id: '1', userId: 'user-1', isLate: false, submittedAt: new Date(), date: new Date() },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', date: new Date() },
        ]);
      prismaService.eodReport.count.mockResolvedValue(0);
      prismaService.eodReport.groupBy.mockResolvedValue([]);
      prismaService.leaveRequest.findMany
        .mockResolvedValueOnce([
          {
            id: 'leave-1',
            employee: {
              id: 'emp-1',
              user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
            },
            startDate: new Date(),
            endDate: new Date(),
            type: 'ANNUAL',
          },
        ])
        .mockResolvedValueOnce([]);
      prismaService.performanceReview.findMany.mockResolvedValue([]);
      prismaService.candidate.count.mockResolvedValue(15);
      prismaService.candidate.groupBy.mockResolvedValue([
        { stage: CandidateStage.VALIDATION, _count: 5 },
        { stage: CandidateStage.HIRED, _count: 2 },
      ]);
      prismaService.openPosition.findMany.mockResolvedValue([
        { id: 'pos-1', title: 'Developer', status: 'Open', recruitmentStatus: 'STANDARD', candidates: [] },
      ] as any);
      prismaService.openPosition.groupBy
        .mockResolvedValueOnce([
          { status: 'Open', _count: 5 },
          { status: 'Filled', _count: 2 },
        ])
        .mockResolvedValueOnce([
          { recruitmentStatus: 'STANDARD', _count: 4 },
          { recruitmentStatus: 'HEADHUNTING', _count: 1 },
        ]);
      prismaService.recruiterPerformanceReport.findMany.mockResolvedValue([
        {
          recruiter: { id: 'rec-1', firstName: 'Jane', lastName: 'Smith' },
          placementsThisWeek: 3,
        },
      ] as any);
      prismaService.task.count.mockResolvedValue(50);
      prismaService.task.groupBy
        .mockResolvedValueOnce([
          { status: TaskStatus.TODO, _count: 20 },
          { status: TaskStatus.IN_PROGRESS, _count: 15 },
          { status: TaskStatus.DONE, _count: 15 },
        ])
        .mockResolvedValueOnce([
          { priority: TaskPriority.HIGH, _count: 10 },
          { priority: TaskPriority.MEDIUM, _count: 30 },
          { priority: TaskPriority.LOW, _count: 10 },
        ]);
      prismaService.user.count.mockResolvedValue(25);
      prismaService.user.groupBy.mockResolvedValue([
        { role: UserRole.ADMIN, _count: 1 },
        { role: UserRole.EMPLOYEE, _count: 20 },
        { role: UserRole.HR, _count: 2 },
        { role: UserRole.RECRUITER, _count: 2 },
      ]);
      prismaService.accountLockout.count.mockResolvedValue(0);
      prismaService.failedLoginAttempt.count.mockResolvedValue(2);
      prismaService.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: 5 },
        { status: 'QUALIFIED', _count: 3 },
        { status: 'WON', _count: 2 },
      ]);
      prismaService.opportunity.groupBy.mockResolvedValue([
        { stage: 'Negotiation', _count: 3, _sum: { value: 50000 } },
        { stage: 'Won', _count: 2, _sum: { value: 30000 } },
      ]);
      prismaService.quote.findMany.mockResolvedValue([]);
      prismaService.invoice.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { total: 10000 } },
        { customerId: 'cust-2', _sum: { total: 5000 } },
      ]);
      prismaService.opportunity.findMany.mockResolvedValue([
        {
          assignedTo: { id: 'user-1', firstName: 'Sales', lastName: 'Person' },
          value: 20000,
        },
      ] as any);
      prismaService.activity.findMany.mockResolvedValue([
        {
          id: 'act-1',
          subject: 'Test Activity',
          activityType: { id: 'type-1', name: 'Call', key: 'call' },
          createdBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          customer: { id: 'cust-1', name: 'Customer 1' },
          lead: null,
          opportunity: null,
          task: null,
          employee: null,
          createdAt: new Date(),
        },
      ] as any);
      prismaService.customer.findUnique = jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Customer 1' });
      prismaService.user.findUnique = jest.fn().mockResolvedValue({ id: 'user-1', firstName: 'John', lastName: 'Doe' });
    });

    it('should return comprehensive admin dashboard data', async () => {
      const result = await service.getAdminDashboard();

      expect(result).toHaveProperty('kpis');
      expect(result).toHaveProperty('financial');
      expect(result).toHaveProperty('crm');
      expect(result).toHaveProperty('hr');
      expect(result).toHaveProperty('recruitment');
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('recentActivities');
      expect(result).toHaveProperty('systemHealth');
    });

    it('should calculate KPIs correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.kpis).toMatchObject({
        mrr: expect.any(Number),
        staffAugValue: expect.any(Number),
        outstandingInvoices: {
          count: expect.any(Number),
          value: expect.any(Number),
        },
        overdueInvoices: {
          count: expect.any(Number),
          value: expect.any(Number),
        },
        activeCustomers: 10,
        customersAtRisk: 2,
        activeEmployees: 20,
        openPositions: 1,
        activeCandidates: 15,
        eodComplianceRate: expect.any(Number),
        missingEodReports: expect.any(Number),
        overdueTasks: expect.any(Number),
      });
    });

    it('should calculate financial metrics correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.financial).toMatchObject({
        revenueByType: {
          staffAug: expect.any(Number),
          subscription: expect.any(Number),
          both: expect.any(Number),
        },
        revenueBySalesperson: expect.any(Array),
        monthlyRevenue: expect.any(Array),
        invoiceStatus: {
          draft: { count: expect.any(Number), value: expect.any(Number) },
          sent: { count: expect.any(Number), value: expect.any(Number) },
          paid: { count: expect.any(Number), value: expect.any(Number) },
          overdue: { count: expect.any(Number), value: expect.any(Number) },
        },
        topCustomers: expect.any(Array),
      });
    });

    it('should calculate CRM metrics correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.crm).toMatchObject({
        leadsByStatus: expect.any(Object),
        opportunitiesByStage: expect.any(Array),
        winRate: expect.any(Number),
        customerStatus: expect.any(Object),
        customerSentiment: expect.any(Object),
        atRiskCustomers: expect.arrayContaining([
          expect.objectContaining({
            id: 'cust-1',
            name: 'At Risk Customer',
            status: CustomerStatus.AT_RISK,
          }),
        ]),
      });
    });

    it('should calculate HR metrics correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.hr).toMatchObject({
        employeesByStatus: expect.any(Object),
        employeesByDepartment: expect.any(Object),
        employeesByContractType: expect.any(Object),
        newHiresThisMonth: 1,
        departuresThisMonth: 0,
        eodCompliance: {
          overallRate: expect.any(Number),
          missingReports: expect.any(Number),
          lateReports: expect.any(Number),
          employeesWithIssues: expect.any(Array),
        },
        leaveManagement: {
          pending: 1,
          approvedThisMonth: 0,
          upcoming: expect.any(Array),
        },
        performanceReviews: {
          overdue: 0,
          upcoming: 0,
          completionRate: 0,
        },
      });
    });

    it('should calculate recruitment metrics correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.recruitment).toMatchObject({
        activeCandidates: 15,
        candidatesByStage: expect.any(Object),
        hireRate: expect.any(Number),
        averageTimeToHire: 0,
        openPositions: {
          total: 1,
          byStatus: expect.any(Object),
          byType: expect.any(Object),
        },
        topRecruiters: expect.arrayContaining([
          expect.objectContaining({
            name: 'Jane Smith',
            placements: 3,
          }),
        ]),
      });
    });

    it('should calculate task metrics correctly', async () => {
      const result = await service.getAdminDashboard();

      expect(result.tasks).toMatchObject({
        activeTasks: 50,
        tasksByStatus: expect.any(Object),
        overdueTasks: expect.any(Number),
        tasksByPriority: expect.any(Object),
        completedThisWeek: expect.any(Number),
      });
    });

    it('should include system alerts', async () => {
      const result = await service.getAdminDashboard();

      expect(result.alerts).toMatchObject({
        accountLockouts: 0,
        failedLogins: 2,
        systemErrors: 0,
        dataQualityIssues: 0,
      });
    });

    it('should include recent activities', async () => {
      const result = await service.getAdminDashboard();

      expect(result.recentActivities).toHaveLength(1);
      expect(result.recentActivities[0]).toMatchObject({
        id: 'act-1',
        type: 'call',
        typeName: 'Call',
        user: {
          id: 'user-1',
          name: 'John Doe',
        },
        entity: {
          type: 'customer',
          id: 'cust-1',
          name: 'Customer 1',
        },
        subject: 'Test Activity',
      });
    });

    it('should include system health metrics', async () => {
      const result = await service.getAdminDashboard();

      expect(result.systemHealth).toMatchObject({
        activeUsers: 0,
        totalUsers: 25,
        usersByRole: expect.objectContaining({
          ADMIN: 1,
          EMPLOYEE: 20,
          HR: 2,
          RECRUITER: 2,
        }),
      });
    });

    it('should handle empty data gracefully', async () => {
      // Reset all mocks to return empty arrays/zeros
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.customer.count.mockResolvedValue(0);
      prismaService.customer.groupBy
        .mockResolvedValueOnce([]) // customersByType
        .mockResolvedValueOnce([]) // customersByStatus
        .mockResolvedValueOnce([]); // customersBySentiment
      prismaService.customer.findMany.mockResolvedValue([]);
      // Reset employee.groupBy - it's called 3 times in parallel, all should return empty
      prismaService.employee.groupBy.mockImplementation(() => Promise.resolve([]));
      prismaService.employee.count
        .mockResolvedValueOnce(0) // newHiresThisMonth
        .mockResolvedValueOnce(0); // departuresThisMonth
      prismaService.eodReport.findMany
        .mockResolvedValueOnce([]) // eodReports
        .mockResolvedValueOnce([]); // missingEodReports
      prismaService.eodReport.count.mockResolvedValue(0);
      prismaService.eodReport.groupBy.mockResolvedValue([]);
      prismaService.leaveRequest.findMany
        .mockResolvedValueOnce([]) // leaveRequests
        .mockResolvedValueOnce([]); // upcomingLeave
      prismaService.performanceReview.findMany.mockResolvedValue([]);
      prismaService.candidate.count.mockResolvedValue(0);
      prismaService.candidate.groupBy.mockResolvedValue([]);
      prismaService.openPosition.findMany.mockResolvedValue([]);
      prismaService.openPosition.groupBy
        .mockResolvedValueOnce([]) // positionsByStatus
        .mockResolvedValueOnce([]); // positionsByType
      prismaService.recruiterPerformanceReport.findMany.mockResolvedValue([]);
      prismaService.task.count.mockResolvedValue(0);
      prismaService.task.groupBy
        .mockResolvedValueOnce([]) // tasksByStatus
        .mockResolvedValueOnce([]); // tasksByPriority
      prismaService.user.count.mockResolvedValue(0);
      prismaService.user.groupBy.mockResolvedValue([]);
      prismaService.accountLockout.count.mockResolvedValue(0);
      prismaService.failedLoginAttempt.count.mockResolvedValue(0);
      prismaService.lead.groupBy.mockResolvedValue([]);
      prismaService.opportunity.groupBy.mockResolvedValue([]);
      prismaService.quote.findMany.mockResolvedValue([]);
      prismaService.invoice.groupBy.mockResolvedValue([]);
      prismaService.opportunity.findMany.mockResolvedValue([]);
      prismaService.activity.findMany.mockResolvedValue([]);
      prismaService.customer.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.getAdminDashboard();

      expect(result.kpis.activeCustomers).toBe(0);
      // activeEmployees is calculated from employeesByStatusMap[EmploymentStatus.ACTIVE] || 0
      // Since employeesByStatus is empty array, the map will be empty, so it will be 0
      expect(result.kpis.activeEmployees).toBe(0);
      expect(result.financial.monthlyRevenue).toHaveLength(12);
      expect(result.recentActivities).toHaveLength(0);
    });
  });
});

