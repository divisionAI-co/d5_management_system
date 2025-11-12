import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

interface GenerateTextOptions {
  prompt: string;
  model?: string;
  temperature?: number;
}

interface GeminiResult {
  text: string;
  rawResponse: unknown;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey?: string;
  private client?: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? undefined;
    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  async generateText(options: GenerateTextOptions): Promise<GeminiResult> {
    this.ensureConfigured();

    const modelId =
      options.model ??
      this.configService.get<string>('GEMINI_MODEL_ID') ??
      'gemini-1.5-pro-latest';

    try {
      const model = this.client!.getGenerativeModel({
        model: modelId,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: options.prompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
        },
      });

      const text = response.response?.text() ?? '';

      return {
        text,
        rawResponse: response.response,
      };
    } catch (error) {
      this.logger.error('Gemini request failed', error as Error);
      throw new InternalServerErrorException('Gemini request failed');
    }
  }

  private ensureConfigured() {
    if (!this.client) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured. Set GEMINI_API_KEY to enable Gemini actions.',
      );
    }
  }
}


