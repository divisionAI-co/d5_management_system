import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { addDays, addWeeks, addMonths, addYears, startOfDay, isBefore, isAfter } from 'date-fns';
// Note: TaskRecurrenceType will be available from @prisma/client after running `prisma generate`
// Using string type for now since it comes from raw query
type TaskRecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

@Injectable()
export class TasksSchedulerService {
  private readonly logger = new Logger(TasksSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate recurring tasks daily at 00:00 UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateRecurringTasks() {
    this.logger.log('Starting recurring tasks generation...');

    try {
      const now = new Date();
      const today = startOfDay(now);

      // Find all active templates
      // Note: After running `prisma generate`, use: this.prisma.taskTemplate.findMany(...)
      // Using raw query temporarily until Prisma client is regenerated
      const activeTemplates = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        recurrenceType: string;
        recurrenceInterval: number;
        isActive: boolean;
        startDate: Date;
        endDate: Date | null;
        defaultAssigneeIds: string[];
        defaultCustomerId: string | null;
        defaultTags: string[];
        defaultEstimatedHours: Prisma.Decimal | null;
        createdById: string;
        lastGeneratedDate: Date | null;
      }>>(
        `SELECT * FROM task_templates 
         WHERE "isActive" = true 
         AND "startDate" <= $1::date 
         AND ("endDate" IS NULL OR "endDate" >= $1::date)`,
        today
      );

      let generatedCount = 0;

      for (const template of activeTemplates) {
        try {
          // Cast recurrenceType to TaskRecurrenceType for type compatibility
          const templateWithTypedRecurrence = {
            ...template,
            recurrenceType: template.recurrenceType as TaskRecurrenceType,
          };
          const shouldGenerate = await this.shouldGenerateTaskForDate(templateWithTypedRecurrence, today);
          
          if (shouldGenerate) {
            await this.generateTaskFromTemplate(template, today);
            generatedCount++;

            // Update lastGeneratedDate
            // Note: After running `prisma generate`, use: this.prisma.taskTemplate.update(...)
            await this.prisma.$executeRawUnsafe(
              `UPDATE task_templates SET "lastGeneratedDate" = $1::date WHERE id::text = $2`,
              today,
              template.id
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to generate task from template ${template.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(`Generated ${generatedCount} recurring tasks`);
    } catch (error) {
      this.logger.error(
        `Error in recurring tasks generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Check if a task should be generated for the given date based on recurrence pattern
   */
  private async shouldGenerateTaskForDate(
    template: {
      id: string;
      recurrenceType: TaskRecurrenceType;
      recurrenceInterval: number;
      startDate: Date;
      endDate: Date | null;
      lastGeneratedDate: Date | null;
    },
    targetDate: Date,
  ): Promise<boolean> {
    // Check if date is within template's date range
    if (isBefore(targetDate, startOfDay(template.startDate))) {
      return false;
    }

    if (template.endDate && isAfter(targetDate, startOfDay(template.endDate))) {
      return false;
    }

    // Check if task already exists for this date
    // Note: After running `prisma generate`, use: this.prisma.task.findFirst(...)
    const existingTasks = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM tasks WHERE "templateId"::text = $1 AND "generatedForDate" = $2::date LIMIT 1`,
      template.id,
      targetDate
    );
    const existingTask = existingTasks.length > 0 ? existingTasks[0] : null;

    if (existingTask) {
      return false; // Task already generated for this date
    }

    // Calculate next generation date based on recurrence pattern
    let nextDate = startOfDay(template.startDate);
    this.logger.debug(`[TasksSchedulerService] Initial nextDate (from startDate): ${nextDate.toISOString().split('T')[0]}, targetDate: ${targetDate.toISOString().split('T')[0]}`);

    // If we have a lastGeneratedDate, start from the date AFTER it (already generated)
    if (template.lastGeneratedDate) {
      this.logger.debug(`[TasksSchedulerService] Template has lastGeneratedDate: ${template.lastGeneratedDate.toISOString().split('T')[0]}`);
      nextDate = startOfDay(template.lastGeneratedDate);
      // Move to the next occurrence after the last generated date
      switch (template.recurrenceType) {
        case 'DAILY':
          nextDate = addDays(nextDate, template.recurrenceInterval);
          break;
        case 'WEEKLY':
          nextDate = addWeeks(nextDate, template.recurrenceInterval);
          break;
        case 'MONTHLY':
          nextDate = addMonths(nextDate, template.recurrenceInterval);
          break;
        case 'YEARLY':
          nextDate = addYears(nextDate, template.recurrenceInterval);
          break;
      }
      this.logger.debug(`[TasksSchedulerService] After advancing from lastGeneratedDate, nextDate: ${nextDate.toISOString().split('T')[0]}`);
    }

    // If nextDate equals targetDate, we should generate (first task or next in sequence)
    if (nextDate.getTime() === targetDate.getTime()) {
      this.logger.debug(`[TasksSchedulerService] nextDate equals targetDate, returning true`);
      return true;
    }

    // If nextDate is after targetDate, we've missed it (shouldn't generate)
    if (isAfter(nextDate, targetDate)) {
      return false;
    }

    // Calculate forward from nextDate to see if targetDate matches the recurrence pattern
    while (isBefore(nextDate, targetDate)) {
      const previousDate = new Date(nextDate);

      switch (template.recurrenceType) {
        case 'DAILY':
          nextDate = addDays(nextDate, template.recurrenceInterval);
          break;
        case 'WEEKLY':
          nextDate = addWeeks(nextDate, template.recurrenceInterval);
          break;
        case 'MONTHLY':
          nextDate = addMonths(nextDate, template.recurrenceInterval);
          break;
        case 'YEARLY':
          nextDate = addYears(nextDate, template.recurrenceInterval);
          break;
      }

      // If nextDate equals targetDate, we should generate
      if (nextDate.getTime() === targetDate.getTime()) {
        return true;
      }

      // Prevent infinite loop (safety check)
      if (nextDate.getTime() === previousDate.getTime()) {
        break;
      }

      // If we've passed the target date, no need to generate
      if (isAfter(nextDate, targetDate)) {
        return false;
      }
    }

    return false;
  }

  /**
   * Public method to generate a task for a specific template and date
   * Used for immediate generation when template is created/activated
   */
  async generateTaskForTemplateAndDate(templateId: string, targetDate: Date): Promise<boolean> {
    this.logger.log(`[TasksSchedulerService] generateTaskForTemplateAndDate called for template ${templateId}, targetDate: ${targetDate.toISOString().split('T')[0]}`);
    try {
      // Fetch template
      // Using $queryRawUnsafe - cast column to text for comparison with string parameter
      const templateResult = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        recurrenceType: string;
        recurrenceInterval: number;
        isActive: boolean;
        startDate: Date;
        endDate: Date | null;
        defaultAssigneeIds: string[];
        defaultCustomerId: string | null;
        defaultTags: string[];
        defaultEstimatedHours: Prisma.Decimal | null;
        createdById: string;
        lastGeneratedDate: Date | null;
      }>>(
        `SELECT * FROM task_templates WHERE id::text = $1`,
        templateId
      );

      if (templateResult.length === 0) {
        this.logger.warn(`Template ${templateId} not found for immediate generation`);
        return false;
      }

      const template = templateResult[0];
      
      // Ensure dates are Date objects (raw query might return strings)
      const templateWithDates = {
        ...template,
        startDate: template.startDate instanceof Date ? template.startDate : new Date(template.startDate),
        endDate: template.endDate ? (template.endDate instanceof Date ? template.endDate : new Date(template.endDate)) : null,
        lastGeneratedDate: template.lastGeneratedDate ? (template.lastGeneratedDate instanceof Date ? template.lastGeneratedDate : new Date(template.lastGeneratedDate)) : null,
      };
      
      // Check if template is active
      if (!templateWithDates.isActive) {
        this.logger.debug(`Template ${templateId} is not active, skipping immediate generation`);
        return false;
      }

      // Cast recurrenceType for type compatibility
      const templateWithTypedRecurrence = {
        ...templateWithDates,
        recurrenceType: templateWithDates.recurrenceType as TaskRecurrenceType,
      };

      // Check if task should be generated for this date
      this.logger.debug(`[TasksSchedulerService] Checking if task should be generated for template ${templateId}, recurrence: ${templateWithDates.recurrenceType} (interval: ${templateWithDates.recurrenceInterval}), startDate: ${templateWithDates.startDate.toISOString().split('T')[0]}, targetDate: ${targetDate.toISOString().split('T')[0]}`);
      const shouldGenerate = await this.shouldGenerateTaskForDate(
        templateWithTypedRecurrence,
        targetDate,
      );

      this.logger.debug(`[TasksSchedulerService] shouldGenerate result for template ${templateId}: ${shouldGenerate}`);

      if (shouldGenerate) {
        await this.generateTaskFromTemplate(templateWithDates, targetDate);
        
        // Update lastGeneratedDate
        await this.prisma.$executeRawUnsafe(
          `UPDATE task_templates SET "lastGeneratedDate" = $1::date WHERE id::text = $2`,
          targetDate,
          templateId
        );

        this.logger.log(`Immediately generated task from template ${templateId} for date ${targetDate.toISOString().split('T')[0]}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to generate task immediately for template ${templateId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Generate a task instance from a template
   */
  private async generateTaskFromTemplate(
    template: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      defaultAssigneeIds: string[];
      defaultCustomerId: string | null;
      defaultTags: string[];
      defaultEstimatedHours: Prisma.Decimal | null;
      createdById: string;
    },
    targetDate: Date,
  ): Promise<void> {
    // Determine assignee IDs - use first for legacy assignedToId, all for assignees
    const assigneeIds = template.defaultAssigneeIds.length > 0 
      ? template.defaultAssigneeIds 
      : [];

    // Validate assignees exist
    if (assigneeIds.length > 0) {
      const assignees = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true },
      });

      if (assignees.length !== assigneeIds.length) {
        throw new Error(`Some assignees not found for template ${template.id}`);
      }
    }

    // Create the task
    const legacyAssignedToId = assigneeIds.length > 0 ? assigneeIds[0] : null;

    // Create task using raw query until Prisma client is regenerated
    // Note: After running `prisma generate`, use: this.prisma.task.create({ data: {...} })
    // Convert UUIDs to strings and handle nulls properly
    const assignedToIdStr = legacyAssignedToId || null;
    const customerIdStr = template.defaultCustomerId || null;
    
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO tasks (
        id, title, description, status, priority,
        "assignedToId", "createdById", "customerId", tags,
        "templateId", "generatedAt", "generatedForDate", "estimatedHours",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3::"TaskStatus",
        $4::"TaskPriority",
        $5::uuid,
        $6::uuid,
        $7::uuid,
        $8::text[],
        $9::uuid,
        $10::timestamp,
        $11::date,
        $12::decimal,
        NOW(),
        NOW()
      )
    `,
      template.title,
      template.description ?? null,
      template.status,
      template.priority,
      assignedToIdStr,
      template.createdById,
      customerIdStr,
      template.defaultTags ?? [],
      template.id,
      new Date(),
      targetDate,
      template.defaultEstimatedHours ? Number(template.defaultEstimatedHours) : null,
    );

    // Get the task ID from the result
    const taskResult = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      SELECT id FROM tasks
      WHERE "templateId"::text = $1
      AND "generatedForDate" = $2::date
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, template.id, targetDate);

    const taskId = taskResult[0]?.id;
    if (!taskId) {
      throw new Error(`Failed to create task from template ${template.id}`);
    }

    // Create assignees if any
    if (assigneeIds.length > 0 && taskId) {
      for (const userId of assigneeIds) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO task_assignees (id, "taskId", "userId", "assignedAt")
          VALUES (gen_random_uuid(), $1::uuid, $2::uuid, NOW())
        `, taskId, userId);
      }
    }

    this.logger.debug(`Generated task from template ${template.id} for date ${targetDate.toISOString().split('T')[0]}`);
  }
}

