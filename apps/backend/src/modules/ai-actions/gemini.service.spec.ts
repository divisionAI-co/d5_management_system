import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai');

describe('GeminiService', () => {
  let service: GeminiService;
  let configService: any;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      generateContent: jest.fn(),
    };

    const mockClient = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    };

    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(
      () => mockClient as any,
    );

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      // Re-instantiate service with API key
      const moduleWithKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'GEMINI_API_KEY') return 'test-api-key';
                if (key === 'GEMINI_MODEL_ID') return 'gemini-1.5-pro-latest';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithKey = moduleWithKey.get<GeminiService>(GeminiService);
      const mockClientWithKey = (serviceWithKey as any).client;
      const mockModelWithKey = mockClientWithKey.getGenerativeModel();

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Generated text response'),
        },
      };

      mockModelWithKey.generateContent.mockResolvedValue(mockResponse);

      const result = await serviceWithKey.generateText({
        prompt: 'Test prompt',
      });

      expect(result.text).toBe('Generated text response');
      expect(mockModelWithKey.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Test prompt' }],
            },
          ],
        }),
      );
    });

    it('should use default model when not specified', async () => {
      // Re-instantiate service with API key
      const moduleWithKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'GEMINI_API_KEY') return 'test-api-key';
                if (key === 'GEMINI_MODEL_ID') return 'gemini-1.5-pro-latest';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithKey = moduleWithKey.get<GeminiService>(GeminiService);
      const mockClientWithKey = (serviceWithKey as any).client;
      const mockModelWithKey = mockClientWithKey.getGenerativeModel();

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response'),
        },
      };

      mockModelWithKey.generateContent.mockResolvedValue(mockResponse);

      await serviceWithKey.generateText({
        prompt: 'Test prompt',
      });

      expect(mockModelWithKey.generateContent).toHaveBeenCalled();
    });

    it('should use custom model when specified', async () => {
      // Re-instantiate service with API key
      const moduleWithKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'GEMINI_API_KEY') return 'test-api-key';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithKey = moduleWithKey.get<GeminiService>(GeminiService);
      const mockClientWithKey = (serviceWithKey as any).client;
      const mockModelWithKey = mockClientWithKey.getGenerativeModel();

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response'),
        },
      };

      mockModelWithKey.generateContent.mockResolvedValue(mockResponse);

      await serviceWithKey.generateText({
        prompt: 'Test prompt',
        model: 'gemini-2.0',
      });

      expect(mockModelWithKey.generateContent).toHaveBeenCalled();
    });

    it('should use custom temperature when specified', async () => {
      // Re-instantiate service with API key
      const moduleWithKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'GEMINI_API_KEY') return 'test-api-key';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const serviceWithKey = moduleWithKey.get<GeminiService>(GeminiService);
      const mockClientWithKey = (serviceWithKey as any).client;
      const mockModelWithKey = mockClientWithKey.getGenerativeModel();

      const mockResponse = {
        response: {
          text: jest.fn().mockReturnValue('Response'),
        },
      };

      mockModelWithKey.generateContent.mockResolvedValue(mockResponse);

      await serviceWithKey.generateText({
        prompt: 'Test prompt',
        temperature: 0.5,
      });

      expect(mockModelWithKey.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: {
            temperature: 0.5,
          },
        }),
      );
    });

    it('should throw InternalServerErrorException when API key is missing', async () => {
      // Re-instantiate service without API key
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();

      const serviceWithoutKey = moduleWithoutKey.get<GeminiService>(GeminiService);

      await expect(
        serviceWithoutKey.generateText({
          prompt: 'Test prompt',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when API call fails', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test-api-key';
        return undefined;
      });

      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(
        service.generateText({
          prompt: 'Test prompt',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});

