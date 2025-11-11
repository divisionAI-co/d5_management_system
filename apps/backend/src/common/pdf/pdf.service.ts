import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;

  constructor(private configService: ConfigService) {}

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
      
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(executablePath && { executablePath }),
      });

      this.logger.log('Puppeteer browser initialized');
    }

    return this.browser;
  }

  async generatePdfFromHtml(html: string, options?: puppeteer.PDFOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
        ...options,
      });

      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Error generating PDF', error);
      throw error;
    } finally {
      await page.close();
    }
  }

  async generatePdfFromTemplate(
    templateHtml: string,
    data: any,
    options?: puppeteer.PDFOptions,
  ): Promise<Buffer> {
    try {
      const template = Handlebars.compile(templateHtml);
      const html = template(data);

      return this.generatePdfFromHtml(html, options);
    } catch (error) {
      this.logger.error('Error generating PDF from template', error);
      throw error;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Puppeteer browser closed');
    }
  }

  // Helper: Register custom Handlebars helpers
  registerHelpers() {
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString();
    });

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
  }
}

