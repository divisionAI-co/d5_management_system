import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

describe('HolidaysService', () => {
  let service: HolidaysService;
  let prismaService: any;

  const mockHoliday = {
    id: 'holiday-1',
    name: 'New Year',
    date: new Date('2024-01-01'),
    country: 'AL',
    isRecurring: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      nationalHoliday: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidaysService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HolidaysService>(HolidaysService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createHolidayDto: CreateHolidayDto = {
      name: 'New Year',
      date: '2024-01-01',
      isRecurring: true,
    };

    it('should create a holiday successfully', async () => {
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.nationalHoliday.create.mockResolvedValue(mockHoliday);

      const result = await service.create(createHolidayDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(createHolidayDto.name);
      expect(prismaService.nationalHoliday.findFirst).toHaveBeenCalledWith({
        where: {
          date: expect.any(Date),
          country: 'AL',
        },
      });
      expect(prismaService.nationalHoliday.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when holiday already exists on date', async () => {
      prismaService.nationalHoliday.findFirst.mockResolvedValue(mockHoliday);

      await expect(service.create(createHolidayDto)).rejects.toThrow(ConflictException);
      expect(prismaService.nationalHoliday.create).not.toHaveBeenCalled();
    });

    it('should default isRecurring to false when not provided', async () => {
      const dtoWithoutRecurring = {
        name: 'New Year',
        date: '2024-01-01',
      };

      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.nationalHoliday.create.mockResolvedValue({
        ...mockHoliday,
        isRecurring: false,
      });

      await service.create(dtoWithoutRecurring);

      expect(prismaService.nationalHoliday.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRecurring: false,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all holidays', async () => {
      const mockHolidays = [mockHoliday];
      prismaService.nationalHoliday.findMany.mockResolvedValue(mockHolidays);

      const result = await service.findAll();

      expect(result).toEqual(mockHolidays);
      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalledWith({
        where: { country: 'AL' },
        orderBy: { date: 'asc' },
      });
    });

    it('should filter holidays by year', async () => {
      const year = 2024;
      prismaService.nationalHoliday.findMany.mockResolvedValue([mockHoliday]);

      await service.findAll(year);

      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalledWith({
        where: {
          country: 'AL',
          date: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31),
          },
        },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return holiday by id', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(mockHoliday);

      const result = await service.findOne('holiday-1');

      expect(result).toEqual(mockHoliday);
      expect(prismaService.nationalHoliday.findUnique).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
      });
    });

    it('should throw NotFoundException when holiday does not exist', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateHolidayDto: UpdateHolidayDto = {
      name: 'Updated Holiday Name',
    };

    it('should update holiday successfully', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(mockHoliday);
      prismaService.nationalHoliday.update.mockResolvedValue({
        ...mockHoliday,
        ...updateHolidayDto,
      });

      const result = await service.update('holiday-1', updateHolidayDto);

      expect(result.name).toBe(updateHolidayDto.name);
      expect(prismaService.nationalHoliday.update).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
        data: expect.any(Object),
      });
    });

    it('should throw NotFoundException when holiday does not exist', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateHolidayDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.nationalHoliday.update).not.toHaveBeenCalled();
    });

    it('should handle date updates', async () => {
      const updateWithDate: UpdateHolidayDto = {
        date: '2024-12-25',
      };

      prismaService.nationalHoliday.findUnique.mockResolvedValue(mockHoliday);
      prismaService.nationalHoliday.update.mockResolvedValue({
        ...mockHoliday,
        date: new Date('2024-12-25'),
      });

      await service.update('holiday-1', updateWithDate);

      expect(prismaService.nationalHoliday.update).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
        data: expect.objectContaining({
          date: expect.any(Date),
        }),
      });
    });

    it('should handle isRecurring updates', async () => {
      const updateWithRecurring: UpdateHolidayDto = {
        isRecurring: false,
      };

      prismaService.nationalHoliday.findUnique.mockResolvedValue(mockHoliday);
      prismaService.nationalHoliday.update.mockResolvedValue({
        ...mockHoliday,
        isRecurring: false,
      });

      await service.update('holiday-1', updateWithRecurring);

      expect(prismaService.nationalHoliday.update).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
        data: expect.objectContaining({
          isRecurring: false,
        }),
      });
    });
  });

  describe('remove', () => {
    it('should delete holiday successfully', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(mockHoliday);
      prismaService.nationalHoliday.delete.mockResolvedValue(mockHoliday);

      const result = await service.remove('holiday-1');

      expect(result).toEqual(mockHoliday);
      expect(prismaService.nationalHoliday.delete).toHaveBeenCalledWith({
        where: { id: 'holiday-1' },
      });
    });

    it('should throw NotFoundException when holiday does not exist', async () => {
      prismaService.nationalHoliday.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prismaService.nationalHoliday.delete).not.toHaveBeenCalled();
    });
  });

  describe('isHoliday', () => {
    it('should return true when date is a holiday', async () => {
      const testDate = new Date('2024-01-01');
      prismaService.nationalHoliday.findFirst.mockResolvedValue(mockHoliday);

      const result = await service.isHoliday(testDate);

      expect(result).toBe(true);
      expect(prismaService.nationalHoliday.findFirst).toHaveBeenCalledWith({
        where: {
          date: expect.any(Date),
          country: 'AL',
        },
      });
    });

    it('should return false when date is not a holiday', async () => {
      const testDate = new Date('2024-01-02');
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);

      const result = await service.isHoliday(testDate);

      expect(result).toBe(false);
    });
  });

  describe('getUpcomingHolidays', () => {
    it('should return upcoming holidays within specified days', async () => {
      const daysAhead = 30;
      const mockUpcomingHolidays = [mockHoliday];

      prismaService.nationalHoliday.findMany.mockResolvedValue(mockUpcomingHolidays);

      const result = await service.getUpcomingHolidays(daysAhead);

      expect(result).toEqual(mockUpcomingHolidays);
      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalledWith({
        where: {
          country: 'AL',
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        orderBy: { date: 'asc' },
      });
    });

    it('should default to 30 days when not specified', async () => {
      prismaService.nationalHoliday.findMany.mockResolvedValue([]);

      await service.getUpcomingHolidays();

      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalled();
    });
  });

  describe('getHolidaysBetween', () => {
    it('should return holidays between two dates', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const mockHolidays = [mockHoliday];

      prismaService.nationalHoliday.findMany.mockResolvedValue(mockHolidays);

      const result = await service.getHolidaysBetween(startDate, endDate);

      expect(result).toEqual(mockHolidays);
      expect(prismaService.nationalHoliday.findMany).toHaveBeenCalledWith({
        where: {
          country: 'AL',
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
      });
    });

    it('should return empty array when no holidays in range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prismaService.nationalHoliday.findMany.mockResolvedValue([]);

      const result = await service.getHolidaysBetween(startDate, endDate);

      expect(result).toEqual([]);
    });
  });
});

