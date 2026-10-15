# Activities and Performance: complete backend replacement files

These are the complete current files, ready to copy to their exact absolute paths. Existing functions and UI outside the changes are included without omissions.

## File index

- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.spec.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.spec.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/employee-kpi.dto.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/employee-kpi.dto.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/create-performance-plan.dto.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/create-performance-plan.dto.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-self-service.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-self-service.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-manager.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-manager.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.spec.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.spec.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/kpi-applicability.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/kpi-applicability.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/employee-kpi.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/employee-kpi.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-plan.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-plan.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.lifecycle.spec.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.lifecycle.spec.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-scorecard.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-scorecard.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-competency.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-competency.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-financial-year.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-financial-year.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.concurrency.postgres.spec.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.concurrency.postgres.spec.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/dto/activity.dto.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/dto/activity.dto.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/manager-activities.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/manager-activities.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/work-activities-admin.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/work-activities-admin.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/my-daily-activities.controller.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/my-daily-activities.controller.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/daily-activity.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/daily-activity.service.ts)
- [/home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.ts](/home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.ts)
- [/home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.spec.ts](/home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.spec.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-audit.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-audit.service.ts)
- [/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/work-activity-audit.service.ts](/home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/work-activity-audit.service.ts)

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.ts

```typescript
import { BadRequestException, ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';

export function assertCalendarDate(value: string, field: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(
      `${field} must be a valid calendar date in YYYY-MM-DD format.`,
    );
  }
}

export function assertDateRange(
  from: string,
  to: string | undefined,
  label: string,
): void {
  assertCalendarDate(from, `${label} start date`);
  if (to !== undefined) {
    assertCalendarDate(to, `${label} end date`);
    if (to < from)
      throw new BadRequestException(
        `${label} end date cannot precede its start date.`,
      );
  }
}

export function assertWeightTotal(
  weights: readonly number[],
  label: string,
): void {
  if (
    !weights.length ||
    weights.some(
      (weight) =>
        !Number.isFinite(weight) ||
        weight <= 0 ||
        weight > 100 ||
        new Decimal(weight).decimalPlaces() > 2,
    )
  ) {
    throw new BadRequestException(
      `${label} weights must be finite, greater than zero, at most 100, and have no more than two decimal places.`,
    );
  }
  const total = weights.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (!total.eq(100))
    throw new BadRequestException(
      `${label} weights must total exactly 100%. Current total: ${total.toString()}%.`,
    );
}

export function assertUniqueValues(
  values: readonly (number | string)[],
  label: string,
): void {
  if (new Set(values).size !== values.length)
    throw new BadRequestException(`${label} cannot contain duplicate items.`);
}

export function assertTransition(
  current: string,
  allowed: readonly string[],
  action: string,
): void {
  if (!allowed.includes(current))
    throw new ConflictException(
      `Cannot ${action} while this review is ${current}. Complete the preceding review step or explicitly reopen an eligible completed review.`,
    );
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/utils/workflow-validation.spec.ts

```typescript
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSelfActivityTaskDto } from '../../work-activities/dto/activity.dto';
import { BadRequestException } from '@nestjs/common';
import {
  assertCalendarDate,
  assertDateRange,
  assertWeightTotal,
} from './workflow-validation';

describe('workflow boundary validation', () => {
  it('accepts leap days only in leap years and rejects timestamp input for date-only fields', () => {
    expect(() => assertCalendarDate('2024-02-29', 'date')).not.toThrow();
    for (const value of [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-01-01T00:00:00Z',
    ])
      expect(() => assertCalendarDate(value, 'date')).toThrow(
        BadRequestException,
      );
    expect(() => assertDateRange('2026-03-01', '2026-02-28', 'Cycle')).toThrow(
      BadRequestException,
    );
  });
  it('accepts exact database-scale weights and rejects cancellation tricks or rounding shortcuts', () => {
    expect(() => assertWeightTotal([33.33, 33.33, 33.34], 'KPI')).not.toThrow();
    for (const values of [
      [101, -1],
      [50, 49.999],
      [NaN, 100],
      [Infinity],
      [],
      [100, 0],
    ])
      expect(() => assertWeightTotal(values, 'KPI')).toThrow(
        BadRequestException,
      );
  });
  it.each([
    [null],
    [
      { id: 'same', title: 'First' },
      { id: 'same', title: 'Second' },
    ],
  ])(
    'returns validation errors for malformed or duplicate checklist items without throwing',
    async (...items: unknown[]) => {
      const dto = plainToInstance(CreateSelfActivityTaskDto, {
        activity_date: '2026-10-12',
        title: 'Work',
        description: 'Description',
        checklist: items,
      });
      await expect(validate(dto)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'checklist' }),
        ]),
      );
    },
  );
});
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/employee-kpi.dto.ts

```typescript
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import {
  EmployeeKpiMeasurementTypeEnum,
  EmployeeKpiProgressSourceEnum,
  EmployeeKpiReviewDecisionEnum,
  EmployeeKpiStatusEnum,
} from '../enums/employee-kpi-status.enum';

export class CreateEmployeeKpiDto {
  @Type(() => Number)
  @IsInt()
  performance_period_id: number;

  @IsString()
  @MaxLength(250)
  title: string;

  @IsString()
  @MaxLength(10000)
  description: string;

  @IsEnum(EmployeeKpiMeasurementTypeEnum)
  measurement_type: EmployeeKpiMeasurementTypeEnum;

  @IsOptional()
  @IsNumber()
  target_value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  unit?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsEnum(EmployeeKpiProgressSourceEnum)
  progress_source?: EmployeeKpiProgressSourceEnum;

  @IsOptional()
  @IsIn(['NUMERIC_TARGET', 'RATING_SCALE', 'MILESTONE', 'MIXED'])
  scoring_type?: 'NUMERIC_TARGET' | 'RATING_SCALE' | 'MILESTONE' | 'MIXED';

  @IsOptional()
  @IsIn(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_MATCH'])
  measurement_direction?:
    | 'HIGHER_IS_BETTER'
    | 'LOWER_IS_BETTER'
    | 'TARGET_MATCH';

  @IsOptional()
  @IsObject()
  formula_config?: Record<string, unknown>;
}

export class CreateAssignedEmployeeKpiDto extends CreateEmployeeKpiDto {
  @Type(() => Number)
  @IsInt()
  employee_id: number;
}

export class UpdateEmployeeKpiDto extends PartialType(CreateEmployeeKpiDto) {}

export class ReviewEmployeeKpiDto {
  @IsEnum(EmployeeKpiReviewDecisionEnum)
  decision: EmployeeKpiReviewDecisionEnum;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}

export class UpdateEmployeeKpiActualDto {
  @IsNumber()
  @Min(0)
  actual_value: number;
}

export class EmployeeKpiQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  performance_period_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employee_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  department_id?: number;

  @IsOptional()
  @IsEnum(EmployeeKpiStatusEnum)
  status?: EmployeeKpiStatusEnum;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reviewer_employee_id?: number;
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/dto/create-performance-plan.dto.ts

```typescript
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreatePerformancePlanItemDto {
  @IsInt()
  @Min(1)
  kpi_definition_version_id: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight: number;

  @IsOptional()
  @IsNumber()
  target_value?: number;

  @IsOptional()
  @IsBoolean()
  manual_entry_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  evidence_required?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePerformancePlanDto {
  @IsInt()
  @Min(1)
  employee_id: number;

  @IsInt()
  @Min(1)
  financial_year_id: number;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  manager_employee_id?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePerformancePlanItemDto)
  items: CreatePerformancePlanItemDto[];
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import type { Response as ExpressResponse } from 'express';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { CalculatePerformanceAggregatesDto } from '../dto/calculate-performance-aggregates.dto';
import { CreateKpiApplicabilityRuleDto } from '../dto/create-kpi-applicability-rule.dto';
import { ApprovePerformanceReviewDto } from '../dto/approve-performance-review.dto';
import { CreateCompetencyTemplateDto } from '../dto/create-competency-template.dto';
import { CreateKpiDefinitionDto } from '../dto/create-kpi-definition.dto';
import { CreatePerformanceFeedback360RequestDto } from '../dto/create-performance-feedback-360-request.dto';
import { CreatePerformanceFinancialYearDto } from '../dto/create-performance-financial-year.dto';
import { CreatePerformanceImprovementPlanDto } from '../dto/create-performance-improvement-plan.dto';
import {
  CarryForwardPerformanceDevelopmentGoalsDto,
  CreatePerformanceDevelopmentPlanDto,
  UpdatePerformanceDevelopmentGoalDto,
} from '../dto/performance-development-plan.dto';
import { CreatePerformancePlanDto } from '../dto/create-performance-plan.dto';
import { CreatePerformanceRatingScaleDto } from '../dto/create-performance-rating-scale.dto';
import { CreatePerformanceScorecardConfigDto } from '../dto/performance-scorecard-config.dto';
import {
  CreatePerformanceWorkflowConfigDto,
  PerformanceWorkflowActionDto,
} from '../dto/performance-workflow.dto';
import { CreateKpiTemplateDto } from '../dto/create-kpi-template.dto';
import { GeneratePerformancePlanFromRulesDto } from '../dto/generate-performance-plan-from-rules.dto';
import { ModeratePerformanceReviewDto } from '../dto/moderate-performance-review.dto';
import { ReopenPerformanceReviewDto } from '../dto/reopen-performance-review.dto';
import { ReopenKpiReviewDto } from '../dto/employee-kpi-cycle-review.dto';
import { ReviewPerformanceImprovementMilestoneDto } from '../dto/review-performance-improvement-milestone.dto';
import { SyncSystemKpisDto } from '../dto/sync-system-kpis.dto';
import { KpiApplicabilityService } from '../services/kpi-applicability.service';
import { KpiDefinitionService } from '../services/kpi-definition.service';
import { KpiDataSourceRegistryService } from '../services/kpi-data-source-registry.service';
import { PerformanceAggregationService } from '../services/performance-aggregation.service';
import { PerformanceCalibrationService } from '../services/performance-calibration.service';
import { PerformanceFeedback360Service } from '../services/performance-feedback-360.service';
import { PerformanceCompetencyService } from '../services/performance-competency.service';
import { PerformanceDevelopmentPlanService } from '../services/performance-development-plan.service';
import { PerformanceFinancialYearService } from '../services/performance-financial-year.service';
import { PerformanceImprovementPlanService } from '../services/performance-improvement-plan.service';
import { PerformanceInsightsService } from '../services/performance-insights.service';
import { PerformancePeriodService } from '../services/performance-period.service';
import { PerformancePlanService } from '../services/performance-plan.service';
import { PerformanceRatingScaleService } from '../services/performance-rating-scale.service';
import { PerformanceReportService } from '../services/performance-report.service';
import type { PerformanceReportFormat } from '../services/performance-report.service';
import { PerformanceReviewService } from '../services/performance-review.service';
import { PerformanceScorecardService } from '../services/performance-scorecard.service';
import { PerformanceWorkflowService } from '../services/performance-workflow.service';
import { EmployeeKpiCycleReviewService } from '../services/employee-kpi-cycle-review.service';
import { EmployeeKpiTemplateAssignmentService } from '../services/employee-kpi-template-assignment.service';
import { ApplyKpiTemplateDto } from '../dto/apply-kpi-template.dto';
import {
  CreatePerformancePeriodDto,
  PerformancePeriodQueryDto,
  ReopenPerformancePeriodDto,
  UpdatePerformancePeriodDto,
} from '../dto/performance-period.dto';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Performance Management')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller('performance')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PerformanceController {
  constructor(
    private readonly financialYearService: PerformanceFinancialYearService,
    private readonly periodService: PerformancePeriodService,
    private readonly ratingScaleService: PerformanceRatingScaleService,
    private readonly scorecardService: PerformanceScorecardService,
    private readonly workflowService: PerformanceWorkflowService,
    private readonly competencyService: PerformanceCompetencyService,
    private readonly kpiDefinitionService: KpiDefinitionService,
    private readonly applicabilityService: KpiApplicabilityService,
    private readonly planService: PerformancePlanService,
    private readonly dataSourceRegistryService: KpiDataSourceRegistryService,
    private readonly reviewService: PerformanceReviewService,
    private readonly improvementPlanService: PerformanceImprovementPlanService,
    private readonly developmentPlanService: PerformanceDevelopmentPlanService,
    private readonly reportService: PerformanceReportService,
    private readonly aggregationService: PerformanceAggregationService,
    private readonly calibrationService: PerformanceCalibrationService,
    private readonly insightsService: PerformanceInsightsService,
    private readonly feedback360Service: PerformanceFeedback360Service,
    private readonly cycleReviewService: EmployeeKpiCycleReviewService,
    private readonly templateAssignmentService: EmployeeKpiTemplateAssignmentService,
  ) {}

  @Post('periods/:id/apply-kpi-template')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_templates:create')
  applyKpiTemplate(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyKpiTemplateDto,
  ) {
    return this.templateAssignmentService.apply(req.user, id, dto);
  }

  @Post('employee-kpis/:id/reopen')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:reopen')
  reopenEmployeeKpi(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenKpiReviewDto,
  ) {
    return this.cycleReviewService.reopenAssignment(req.user, id, dto);
  }

  @Post('financial-years')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_financial_years:create')
  createFinancialYear(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformanceFinancialYearDto,
  ) {
    return this.financialYearService.create(req.user, dto);
  }

  @Get('financial-years')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_financial_years:read')
  listFinancialYears(@Req() req: AuthedRequest) {
    return this.financialYearService.list(req.user);
  }

  @Get('periods')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:read')
  listPeriods(
    @Req() req: AuthedRequest,
    @Query() query: PerformancePeriodQueryDto,
  ) {
    return this.periodService.list(req.user, query);
  }

  @Get('periods/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:read')
  getPeriod(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.periodService.get(req.user, id);
  }

  @Post('periods')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:create')
  createPeriod(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformancePeriodDto,
  ) {
    return this.periodService.create(req.user, dto);
  }

  @Patch('periods/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:update')
  updatePeriod(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformancePeriodDto,
  ) {
    return this.periodService.update(req.user, id, dto);
  }

  @Post('periods/:id/activate')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:activate')
  activatePeriod(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.periodService.activate(req.user, id);
  }

  @Post('periods/:id/close')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:close')
  closePeriod(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.periodService.close(req.user, id);
  }

  @Post('periods/:id/reopen')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:reopen')
  reopenPeriod(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenPerformancePeriodDto,
  ) {
    return this.periodService.reopen(req.user, id, dto);
  }

  @Post('financial-years/:id/generate-periods')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_periods:create')
  generatePeriods(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.periodService.generatePeriods(id, req.user);
  }

  @Post('rating-scales')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_rating_scales:create')
  createRatingScale(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformanceRatingScaleDto,
  ) {
    return this.ratingScaleService.create(req.user, dto);
  }

  @Get('rating-scales')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_rating_scales:read')
  listRatingScales(@Req() req: AuthedRequest) {
    return this.ratingScaleService.list(req.user);
  }

  @Post('scorecards')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_scorecards:create')
  createScorecard(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformanceScorecardConfigDto,
  ) {
    return this.scorecardService.create(req.user, dto);
  }

  @Get('scorecards')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_scorecards:read')
  listScorecards(@Req() req: AuthedRequest) {
    return this.scorecardService.list(req.user);
  }

  @Post('workflows')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_workflows:create')
  createWorkflow(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformanceWorkflowConfigDto,
  ) {
    return this.workflowService.create(req.user, dto);
  }

  @Get('workflows')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_workflows:read')
  listWorkflows(@Req() req: AuthedRequest) {
    return this.workflowService.list(req.user);
  }

  @Post('competency-templates')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_competencies:create')
  createCompetencyTemplate(
    @Req() req: AuthedRequest,
    @Body() dto: CreateCompetencyTemplateDto,
  ) {
    return this.competencyService.createTemplate(req.user, dto);
  }

  @Get('competency-templates')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_competencies:read')
  listCompetencyTemplates(@Req() req: AuthedRequest) {
    return this.competencyService.listTemplates(req.user);
  }

  @Post('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_definitions:create')
  createKpi(@Req() req: AuthedRequest, @Body() dto: CreateKpiDefinitionDto) {
    return this.kpiDefinitionService.create(req.user, dto);
  }

  @Post('kpis/:id/versions')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_definitions:update')
  createKpiVersion(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateKpiDefinitionDto,
  ) {
    return this.kpiDefinitionService.createVersion(req.user, id, dto);
  }

  @Patch('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_definitions:update')
  updateKpi(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateKpiDefinitionDto,
  ) {
    // KPI definitions are versioned: an edit creates the next definition
    // version while keeping historical plan/template references immutable.
    return this.kpiDefinitionService.createVersion(req.user, id, dto);
  }

  @Delete('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_definitions:update')
  archiveKpi(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.kpiDefinitionService.archive(req.user, id);
  }

  @Get('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_definitions:read')
  listKpis(@Req() req: AuthedRequest) {
    return this.kpiDefinitionService.list(req.user);
  }

  @Post('kpi-rules')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_applicability_rules:create')
  createApplicabilityRule(
    @Req() req: AuthedRequest,
    @Body() dto: CreateKpiApplicabilityRuleDto,
  ) {
    return this.applicabilityService.createRule(req.user, dto);
  }

  @Get('kpi-rules')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_applicability_rules:read')
  listApplicabilityRules(@Req() req: AuthedRequest) {
    return this.applicabilityService.listRules(req.user);
  }

  @Post('kpi-templates')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_templates:create')
  createTemplate(@Req() req: AuthedRequest, @Body() dto: CreateKpiTemplateDto) {
    return this.applicabilityService.createTemplate(req.user, dto);
  }

  @Get('kpi-templates')
  @UseGuards(PermissionsGuard)
  @Permissions('kpi_templates:read')
  listTemplates(@Req() req: AuthedRequest) {
    return this.applicabilityService.listTemplates(req.user);
  }

  @Post('plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_plans:create')
  createPlan(@Req() req: AuthedRequest, @Body() dto: CreatePerformancePlanDto) {
    return this.planService.create(req.user, dto);
  }

  @Post('plans/generate-from-rules')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_plans:create')
  generatePlanFromRules(
    @Req() req: AuthedRequest,
    @Body() dto: GeneratePerformancePlanFromRulesDto,
  ) {
    return this.applicabilityService.generatePlanFromRules(req.user, dto);
  }

  @Get('plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_plans:read')
  listPlans(@Req() req: AuthedRequest) {
    return this.planService.list(req.user);
  }

  @Post('periods/:id/assignments')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_assignments:create')
  createAssignmentsForPeriod(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planService.createAssignmentsForPeriod(req.user, id);
  }

  @Post('periods/:id/sync-system-kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:sync')
  syncSystemKpis(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SyncSystemKpisDto,
  ) {
    return this.dataSourceRegistryService.syncPeriod(
      req.user,
      id,
      dto.provider_key,
    );
  }

  @Post('reviews/:periodAssignmentId/approve')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:approve')
  approveReview(
    @Req() req: AuthedRequest,
    @Param('periodAssignmentId', ParseIntPipe) periodAssignmentId: number,
    @Body() dto: ApprovePerformanceReviewDto,
  ) {
    return this.reviewService.approve(req.user, periodAssignmentId, dto);
  }

  @Get('reviews/:id/workflow')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:workflow-read')
  getReviewWorkflow(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workflowService.getReviewWorkflow(req.user, id);
  }

  @Post('reviews/:id/workflow/action')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:workflow-action')
  async actionReviewWorkflow(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PerformanceWorkflowActionDto,
  ) {
    const result = await this.workflowService.actOnCurrentStep(
      req.user,
      id,
      dto,
    );
    if (!result.completed) {
      return result;
    }
    return this.reviewService.approve(req.user, result.periodAssignmentId, dto);
  }

  @Post('reviews/:id/moderate')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:moderate')
  moderateReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModeratePerformanceReviewDto,
  ) {
    return this.reviewService.moderate(req.user, id, dto);
  }

  @Post('reviews/:id/reopen')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:reopen')
  reopenReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReopenPerformanceReviewDto,
  ) {
    return this.reviewService.reopen(req.user, id, dto);
  }

  @Get('appeals')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:appeal-review')
  listAppeals(@Req() req: AuthedRequest) {
    return this.reviewService.listAppeals(req.user);
  }

  @Post('reviews/:id/improvement-plan')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_pip:create')
  createImprovementPlan(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePerformanceImprovementPlanDto,
  ) {
    return this.improvementPlanService.create(req.user, id, dto);
  }

  @Get('improvement-plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_pip:read')
  listImprovementPlans(@Req() req: AuthedRequest) {
    return this.improvementPlanService.list(req.user);
  }

  @Post('development-plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_development_plans:create')
  createDevelopmentPlan(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePerformanceDevelopmentPlanDto,
  ) {
    return this.developmentPlanService.create(req.user, dto);
  }

  @Get('development-plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_development_plans:read')
  listDevelopmentPlans(@Req() req: AuthedRequest) {
    return this.developmentPlanService.list(req.user);
  }

  @Get('reports/catalog')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reports:read')
  listReportCatalog() {
    return this.reportService.catalog();
  }

  @Get('reports/:code/rows')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reports:read')
  reportRows(@Req() req: AuthedRequest, @Param('code') code: string) {
    return this.reportService.rows(req.user, code);
  }

  @Get('reports/:code/export')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reports:export')
  async exportReport(
    @Req() req: AuthedRequest,
    @Param('code') code: string,
    @Query('format') format = 'csv',
    @Res() res: ExpressResponse,
  ) {
    const normalizedFormat = format.toLowerCase() as PerformanceReportFormat;
    const buffer = await this.reportService.export(
      req.user,
      code,
      normalizedFormat,
    );
    const contentTypes: Record<PerformanceReportFormat, string> = {
      json: 'application/json',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };
    res.setHeader('Content-Type', contentTypes[normalizedFormat]);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${code.toLowerCase()}.${normalizedFormat}"`,
    );
    return res.send(buffer);
  }

  @Patch('development-goals/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_development_plans:update')
  updateDevelopmentGoal(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformanceDevelopmentGoalDto,
  ) {
    return this.developmentPlanService.updateGoal(req.user, id, dto);
  }

  @Post('development-plans/carry-forward')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_development_plans:create')
  carryForwardDevelopmentGoals(
    @Req() req: AuthedRequest,
    @Body() dto: CarryForwardPerformanceDevelopmentGoalsDto,
  ) {
    return this.developmentPlanService.carryForward(req.user, dto);
  }

  @Post('improvement-milestones/:id/review')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_pip:review')
  reviewImprovementMilestone(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewPerformanceImprovementMilestoneDto,
  ) {
    return this.improvementPlanService.reviewMilestone(req.user, id, dto);
  }

  @Post('improvement-plans/:id/close')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_pip:close')
  closeImprovementPlan(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.improvementPlanService.close(req.user, id);
  }

  @Post('reviews/:id/feedback-360/invitations')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:invite')
  inviteFeedback360(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePerformanceFeedback360RequestDto,
  ) {
    return this.feedback360Service.invite(req.user, id, dto);
  }

  @Get('reviews/:id/feedback-360')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:read')
  listFeedback360(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.feedback360Service.listForReview(req.user, id);
  }

  @Get('reviews/:id/feedback-360/summary')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:read')
  getFeedback360Summary(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.feedback360Service.getSummaryForReview(req.user, id);
  }

  @Get('calibration/departments')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_calibration:read')
  getCalibrationDepartmentSummary(@Req() req: AuthedRequest) {
    return this.calibrationService.departmentSummary(req.user);
  }

  @Get('calibration/comparison')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_calibration:read')
  getCalibrationComparison(@Req() req: AuthedRequest) {
    return this.calibrationService.comparison(req.user);
  }

  @Get('dashboard/summary')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_dashboards:read')
  getDashboardSummary(@Req() req: AuthedRequest) {
    return this.insightsService.getCompanySummary(req.user);
  }

  @Post('financial-years/:id/aggregates')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_aggregates:calculate')
  calculateAggregates(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CalculatePerformanceAggregatesDto,
  ) {
    return this.aggregationService.calculate(req.user, id, dto.period_type);
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-self-service.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { DeclinePerformanceFeedback360Dto } from '../dto/decline-performance-feedback-360.dto';
import { UpdatePerformanceDevelopmentGoalDto } from '../dto/performance-development-plan.dto';
import { SubmitPerformanceFeedback360Dto } from '../dto/submit-performance-feedback-360.dto';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { SubmitPerformanceAppealDto } from '../dto/submit-performance-appeal.dto';
import { UpsertKpiAchievementDto } from '../dto/upsert-kpi-achievement.dto';
import { KpiAchievementService } from '../services/kpi-achievement.service';
import { PerformanceDevelopmentPlanService } from '../services/performance-development-plan.service';
import { PerformanceFeedback360Service } from '../services/performance-feedback-360.service';
import { PerformanceImprovementPlanService } from '../services/performance-improvement-plan.service';
import { PerformanceInsightsService } from '../services/performance-insights.service';
import { PerformancePlanService } from '../services/performance-plan.service';
import { PerformanceReviewService } from '../services/performance-review.service';
import {
  CreateEmployeeKpiDto,
  EmployeeKpiQueryDto,
  UpdateEmployeeKpiActualDto,
  UpdateEmployeeKpiDto,
} from '../dto/employee-kpi.dto';
import { EmployeeKpiService } from '../services/employee-kpi.service';
import { EmployeeKpiCycleReviewService } from '../services/employee-kpi-cycle-review.service';
import { PerformanceReportService } from '../services/performance-report.service';
import {
  RespondToMidKpiReviewDto,
  SubmitKpiSelfReviewDto,
} from '../dto/employee-kpi-cycle-review.dto';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Performance Self Service')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller('performance/me')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PerformanceSelfServiceController {
  constructor(
    private readonly insightsService: PerformanceInsightsService,
    private readonly achievementService: KpiAchievementService,
    private readonly planService: PerformancePlanService,
    private readonly reviewService: PerformanceReviewService,
    private readonly improvementPlanService: PerformanceImprovementPlanService,
    private readonly developmentPlanService: PerformanceDevelopmentPlanService,
    private readonly employeeKpiService: EmployeeKpiService,
    private readonly cycleReviewService: EmployeeKpiCycleReviewService,
    private readonly performanceReportService: PerformanceReportService,
    private readonly feedback360Service: PerformanceFeedback360Service,
  ) {}

  @Get('kpi-audit')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:read')
  listMyKpiAudit(@Req() req: AuthedRequest) {
    return this.performanceReportService.ownKpiAudit(req.user);
  }

  @Get('kpi-reviews')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:read')
  listKpiReviews(
    @Req() req: AuthedRequest,
    @Query('period_id') periodId?: string,
  ) {
    return this.cycleReviewService.listOwn(
      req.user,
      periodId ? Number(periodId) : undefined,
    );
  }

  @Get('kpi-scores')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:read')
  listKpiScores(@Req() req: AuthedRequest) {
    return this.cycleReviewService.listOwnScores(req.user);
  }

  @Post('kpis/:id/reviews/:kind/self')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:update')
  submitKpiSelfReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'MID' | 'FINAL',
    @Body() dto: SubmitKpiSelfReviewDto,
  ) {
    return this.cycleReviewService.submitSelf(req.user, id, kind, dto);
  }

  @Post('kpis/:id/reviews/mid/respond')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:update')
  respondToMidReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondToMidKpiReviewDto,
  ) {
    return this.cycleReviewService.respondMid(req.user, id, dto);
  }

  @Get('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:read')
  listKpis(@Req() req: AuthedRequest, @Query() query: EmployeeKpiQueryDto) {
    return this.employeeKpiService.listOwn(req.user, query);
  }

  @Post('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:create')
  createKpi(@Req() req: AuthedRequest, @Body() dto: CreateEmployeeKpiDto) {
    return this.employeeKpiService.create(req.user, dto);
  }

  @Get('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:read')
  getKpi(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.employeeKpiService.getOwn(req.user, id);
  }

  @Patch('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:update')
  updateKpi(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeKpiDto,
  ) {
    return this.employeeKpiService.update(req.user, id, dto);
  }

  @Delete('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:update')
  deleteKpi(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.employeeKpiService.remove(req.user, id);
  }

  @Post('kpis/periods/:periodId/submit')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:submit')
  submitKpis(
    @Req() req: AuthedRequest,
    @Param('periodId', ParseIntPipe) periodId: number,
  ) {
    return this.employeeKpiService.submitPeriod(req.user, periodId);
  }

  @Patch('kpis/:id/actual')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:self:update')
  updateKpiActual(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeKpiActualDto,
  ) {
    return this.employeeKpiService.updateActual(req.user, id, dto);
  }

  @Get('summary')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  getSummary(@Req() req: AuthedRequest) {
    return this.insightsService.getEmployeeSummary(req.user);
  }

  @Get('assignments')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  async listAssignments(@Req() req: AuthedRequest) {
    return this.planService.listAssignmentsForEmployee(
      req.user,
      req.user.employeeId!,
    );
  }

  @Get('achievements')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  listAchievements(@Req() req: AuthedRequest) {
    return this.achievementService.listForEmployee(
      req.user,
      req.user.employeeId!,
    );
  }

  @Patch('achievements/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:update')
  updateAchievement(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertKpiAchievementDto,
  ) {
    return this.achievementService.employeeUpsert(req.user, id, dto);
  }

  @Post('reviews/:periodAssignmentId/self-review')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:self-review')
  submitSelfReview(
    @Req() req: AuthedRequest,
    @Param('periodAssignmentId', ParseIntPipe) periodAssignmentId: number,
    @Body() dto: SubmitSelfReviewDto,
  ) {
    return this.reviewService.submitSelfReview(
      req.user,
      periodAssignmentId,
      dto,
    );
  }

  @Get('reviews')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  listReviews(@Req() req: AuthedRequest) {
    return this.reviewService.listForEmployee(req.user, req.user.employeeId!);
  }

  @Post('reviews/:id/appeal')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_reviews:appeal')
  submitAppeal(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitPerformanceAppealDto,
  ) {
    return this.reviewService.submitAppeal(req.user, id, dto);
  }

  @Get('improvement-plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  listImprovementPlans(@Req() req: AuthedRequest) {
    return this.improvementPlanService.list(req.user);
  }

  @Post('improvement-plans/:id/acknowledge')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:update')
  acknowledgeImprovementPlan(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.improvementPlanService.acknowledge(req.user, id);
  }

  @Get('development-plans')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:read')
  listDevelopmentPlans(@Req() req: AuthedRequest) {
    return this.developmentPlanService.list(req.user);
  }

  @Patch('development-goals/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_self_service:update')
  updateDevelopmentGoal(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformanceDevelopmentGoalDto,
  ) {
    return this.developmentPlanService.updateGoal(req.user, id, dto);
  }

  @Get('feedback-360')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:self:read')
  listAssignedFeedback360(@Req() req: AuthedRequest) {
    return this.feedback360Service.listAssignedToMe(req.user);
  }

  @Post('feedback-360/:id/submit')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:self:submit')
  submitFeedback360(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitPerformanceFeedback360Dto,
  ) {
    return this.feedback360Service.submit(req.user, id, dto);
  }

  @Post('feedback-360/:id/decline')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_feedback_360:self:submit')
  declineFeedback360(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeclinePerformanceFeedback360Dto,
  ) {
    return this.feedback360Service.decline(req.user, id, dto);
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/controllers/performance-manager.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { ValidateKpiAchievementDto } from '../dto/validate-kpi-achievement.dto';
import { KpiAchievementService } from '../services/kpi-achievement.service';
import { PerformanceInsightsService } from '../services/performance-insights.service';
import { PerformanceReviewService } from '../services/performance-review.service';
import {
  CreateAssignedEmployeeKpiDto,
  EmployeeKpiQueryDto,
  ReviewEmployeeKpiDto,
} from '../dto/employee-kpi.dto';
import { EmployeeKpiService } from '../services/employee-kpi.service';
import { EmployeeKpiCycleReviewService } from '../services/employee-kpi-cycle-review.service';
import {
  FinalizeKpiReviewDto,
  SubmitKpiManagerReviewDto,
} from '../dto/employee-kpi-cycle-review.dto';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Performance Manager')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller('performance/manager')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PerformanceManagerController {
  constructor(
    private readonly insightsService: PerformanceInsightsService,
    private readonly achievementService: KpiAchievementService,
    private readonly reviewService: PerformanceReviewService,
    private readonly employeeKpiService: EmployeeKpiService,
    private readonly cycleReviewService: EmployeeKpiCycleReviewService,
  ) {}

  @Get('kpi-reviews')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:team:read')
  listKpiReviews(
    @Req() req: AuthedRequest,
    @Query('period_id') periodId?: string,
  ) {
    return this.cycleReviewService.listTeam(
      req.user,
      periodId ? Number(periodId) : undefined,
    );
  }

  @Post('kpis/:id/reviews/:kind/manager')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:review')
  submitKpiManagerReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: 'MID' | 'FINAL',
    @Body() dto: SubmitKpiManagerReviewDto,
  ) {
    return this.cycleReviewService.submitManager(req.user, id, kind, dto);
  }

  @Post('kpis/:id/reviews/final/finalize')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:review')
  finalizeKpiReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalizeKpiReviewDto,
  ) {
    return this.cycleReviewService.finalize(req.user, id, dto);
  }

  @Get('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:team:read')
  listTeamKpis(@Req() req: AuthedRequest, @Query() query: EmployeeKpiQueryDto) {
    return this.employeeKpiService.listTeam(req.user, query);
  }

  @Get('kpi-assignees')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:assign')
  listKpiAssignees(@Req() req: AuthedRequest) {
    return this.employeeKpiService.listAssignableEmployees(req.user);
  }

  @Post('kpis')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:assign')
  assignKpi(
    @Req() req: AuthedRequest,
    @Body() dto: CreateAssignedEmployeeKpiDto,
  ) {
    return this.employeeKpiService.assignToEmployee(req.user, dto);
  }

  @Get('kpis/:id')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:team:read')
  getTeamKpi(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.employeeKpiService.getTeamOne(req.user, id);
  }

  @Post('kpis/:id/begin-review')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:review')
  beginKpiReview(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeeKpiService.markPendingReview(req.user, id);
  }

  @Post('kpis/:id/review')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_kpis:review')
  reviewKpi(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewEmployeeKpiDto,
  ) {
    return this.employeeKpiService.review(req.user, id, dto);
  }

  @Get('summary')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_manager:read')
  getSummary(@Req() req: AuthedRequest) {
    return this.insightsService.getManagerSummary(req.user);
  }

  @Get('team-achievements')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_manager:read')
  listTeamAchievements(@Req() req: AuthedRequest) {
    return this.achievementService.listForManager(req.user);
  }

  @Post('achievements/:id/validate')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_manager:validate')
  validateAchievement(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidateKpiAchievementDto,
  ) {
    return this.achievementService.managerValidate(req.user, id, dto);
  }

  @Post('reviews/:periodAssignmentId/submit')
  @UseGuards(PermissionsGuard)
  @Permissions('performance_manager:review')
  submitReview(
    @Req() req: AuthedRequest,
    @Param('periodAssignmentId', ParseIntPipe) periodAssignmentId: number,
    @Body() dto: SubmitManagerReviewDto,
  ) {
    return this.reviewService.submitManagerReview(
      req.user,
      periodAssignmentId,
      dto,
    );
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.spec.ts

```typescript
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { Department } from '../../departments/entities/department.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { HrAccessService } from '../../shared/hr-access.service';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import {
  PerformanceReviewWorkflowStep,
  PerformanceReviewWorkflowStepStatusEnum,
} from '../entities/performance-review-workflow-step.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import { PerformanceReviewStatusEnum } from '../enums/performance-review-status.enum';
import { PerformanceWorkflowConfig } from '../entities/performance-workflow-config.entity';
import { PerformanceWorkflowStepTypeEnum } from '../enums/performance-workflow-step-type.enum';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformanceWorkflowService } from './performance-workflow.service';

const actor: AuthenticatedUser = {
  id: 1,
  email: 'hr@example.com',
  scope: 'company',
  userType: 'COMPANY_USER',
  companyId: 1,
  companyMembershipId: 10,
  employeeId: 5,
  roles: [],
  permissions: [],
};

function repository<T>(overrides: Partial<Repository<T>> = {}) {
  return {
    create: jest.fn((value: T) => value),
    save: jest.fn(async (value: T) => value),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  } as unknown as Repository<T>;
}

function harness() {
  const hrAccess = {
    ensureActorCompanyId: jest.fn().mockReturnValue(1),
    hasCompanyScope: jest.fn().mockReturnValue(true),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const workflowRepository = repository<PerformanceWorkflowConfig>();
  const reviewStepRepository = repository<PerformanceReviewWorkflowStep>();
  const reviewRepository = repository<PerformanceReview>();
  const assignmentRepository = repository<PerformancePeriodAssignment>();
  const employeeRepository = repository<Employee>();
  const departmentRepository = repository<Department>();

  const manager = {
    getRepository: (entity: unknown) =>
      entity === PerformanceReview
        ? reviewRepository
        : entity === PerformancePeriodAssignment
          ? assignmentRepository
          : reviewStepRepository,
  } as unknown as EntityManager;
  Object.assign(reviewRepository, {
    manager: {
      transaction: (work: (value: EntityManager) => Promise<unknown>) =>
        work(manager),
    },
  });

  const service = new PerformanceWorkflowService(
    hrAccess as unknown as HrAccessService,
    audit as unknown as PerformanceAuditService,
    workflowRepository,
    reviewStepRepository,
    reviewRepository,
    assignmentRepository,
    employeeRepository,
    departmentRepository,
  );

  return {
    service,
    workflowRepository,
    reviewStepRepository,
    reviewRepository,
    assignmentRepository,
  };
}

describe('PerformanceWorkflowService', () => {
  it('rejects duplicate workflow step codes', async () => {
    const { service } = harness();

    await expect(
      service.create(actor, {
        code: 'annual',
        name: 'Annual review',
        steps: [
          {
            code: 'HR',
            label: 'HR review',
            type: PerformanceWorkflowStepTypeEnum.HR_REVIEW,
            sequence_number: 1,
          },
          {
            code: 'HR',
            label: 'Final HR review',
            type: PerformanceWorkflowStepTypeEnum.FINAL_APPROVAL,
            sequence_number: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks the workflow complete when the last pending step is approved', async () => {
    const {
      service,
      reviewRepository,
      assignmentRepository,
      reviewStepRepository,
    } = harness();
    const review = {
      id: 50,
      companyId: 1,
      employeeId: 20,
      periodAssignmentId: 70,
      status: PerformanceReviewStatusEnum.HR_REVIEW_PENDING,
    } as PerformanceReview;
    const assignment = { id: 70, companyId: 1 } as PerformancePeriodAssignment;
    const pendingStep = {
      id: 100,
      companyId: 1,
      performanceReviewId: 50,
      periodAssignmentId: 70,
      sequenceNumber: 1,
      code: 'FINAL',
      label: 'Final approval',
      stepType: PerformanceWorkflowStepTypeEnum.FINAL_APPROVAL,
      status: PerformanceReviewWorkflowStepStatusEnum.PENDING,
      assignedEmployeeId: null,
      assignedCompanyUserId: null,
    } as PerformanceReviewWorkflowStep;
    const approvedStep = {
      ...pendingStep,
      status: PerformanceReviewWorkflowStepStatusEnum.APPROVED,
    };

    jest.spyOn(reviewRepository, 'findOne').mockResolvedValue(review);
    jest.spyOn(assignmentRepository, 'findOne').mockResolvedValue(assignment);
    jest
      .spyOn(reviewStepRepository, 'find')
      .mockResolvedValueOnce([pendingStep])
      .mockResolvedValueOnce([approvedStep]);

    const result = await service.actOnCurrentStep(actor, 50, {
      decision: 'APPROVE',
    });

    expect(result.completed).toBe(true);
    expect(reviewStepRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 100,
        status: PerformanceReviewWorkflowStepStatusEnum.APPROVED,
      }),
    );
  });
  it('does not allow an approval action to change an already published review', async () => {
    const {
      service,
      reviewRepository,
      reviewStepRepository,
      assignmentRepository,
    } = harness();
    jest.spyOn(reviewRepository, 'findOne').mockResolvedValue({
      id: 50,
      companyId: 1,
      status: PerformanceReviewStatusEnum.PUBLISHED,
    } as PerformanceReview);
    jest.spyOn(assignmentRepository, 'findOne').mockResolvedValue({
      id: 70,
      companyId: 1,
    } as PerformancePeriodAssignment);
    await expect(
      service.actOnCurrentStep(actor, 50, { decision: 'APPROVE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(reviewStepRepository.save).not.toHaveBeenCalled();
  });
});
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/kpi-applicability.service.ts

```typescript
import {
  assertWeightTotal,
  assertUniqueValues,
} from '../utils/workflow-validation';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { Employee } from '../../employees/entities/employee.entity';
import { Role } from '../../../roles/entities/role.entity';
import { HrAccessService } from '../../shared/hr-access.service';
import { CreateKpiApplicabilityRuleDto } from '../dto/create-kpi-applicability-rule.dto';
import { CreateKpiTemplateDto } from '../dto/create-kpi-template.dto';
import { GeneratePerformancePlanFromRulesDto } from '../dto/generate-performance-plan-from-rules.dto';
import { EmployeePerformancePlan } from '../entities/employee-performance-plan.entity';
import { KpiApplicabilityRule } from '../entities/kpi-applicability-rule.entity';
import { KpiDefinitionVersion } from '../entities/kpi-definition-version.entity';
import { KpiTemplate } from '../entities/kpi-template.entity';
import { PerformanceFinancialYear } from '../entities/performance-financial-year.entity';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { KpiApplicabilityRuleStatusEnum } from '../enums/kpi-applicability-rule-status.enum';
import { KpiTemplateStatusEnum } from '../enums/kpi-template-status.enum';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformancePlanService } from './performance-plan.service';

type ResolvedPlanItem = {
  kpi_definition_version_id: number;
  weight: number;
  target_value?: number;
  manual_entry_allowed?: boolean;
  evidence_required?: boolean;
  notes?: string;
};

type ResolvedRuleContext = {
  employee: Employee;
  financialYearId: number;
  reviewCycle?: string;
};

@Injectable()
export class KpiApplicabilityService {
  constructor(
    private readonly hrAccessService: HrAccessService,
    private readonly planService: PerformancePlanService,
    private readonly auditService: PerformanceAuditService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(KpiApplicabilityRule)
    private readonly ruleRepository: Repository<KpiApplicabilityRule>,
    @InjectRepository(KpiTemplate)
    private readonly templateRepository: Repository<KpiTemplate>,
    @InjectRepository(KpiDefinitionVersion)
    private readonly versionRepository: Repository<KpiDefinitionVersion>,
    @InjectRepository(PerformanceFinancialYear)
    private readonly financialYearRepository: Repository<PerformanceFinancialYear>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async createRule(
    actor: AuthenticatedUser,
    dto: CreateKpiApplicabilityRuleDto,
  ): Promise<KpiApplicabilityRule> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);

    const version = await this.versionRepository.findOne({
      where: { id: dto.kpi_definition_version_id },
    });

    if (!version) {
      throw new NotFoundException('KPI definition version not found.');
    }

    const rule = await this.ruleRepository.save(
      this.ruleRepository.create({
        companyId,
        kpiDefinitionVersionId: dto.kpi_definition_version_id,
        name: dto.name?.trim() ?? null,
        status: KpiApplicabilityRuleStatusEnum.ACTIVE,
        priority: dto.priority ?? 0,
        financialYearId: dto.financial_year_id ?? null,
        branchId: dto.branch_id ?? null,
        departmentId: dto.department_id ?? null,
        positionId: dto.position_id ?? null,
        gradeId: dto.grade_id ?? null,
        employmentType: dto.employment_type?.trim() ?? null,
        employeeId: dto.employee_id ?? null,
        reviewCycle: dto.review_cycle?.trim() ?? null,
        templateCode: dto.template_code?.trim().toUpperCase() ?? null,
        weightOverride:
          dto.weight_override === undefined
            ? null
            : String(dto.weight_override),
        targetOverride:
          dto.target_override === undefined
            ? null
            : String(dto.target_override),
        metadata: dto.metadata ?? null,
      }),
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.APPLICABILITY_RULE_CREATED,
      actor,
      afterValues: {
        kpi_applicability_rule_id: rule.id,
        kpi_definition_version_id: rule.kpiDefinitionVersionId,
      },
    });

    return rule;
  }

  async listRules(actor: AuthenticatedUser): Promise<KpiApplicabilityRule[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.ruleRepository.find({
      where: { companyId },
      order: { priority: 'DESC', id: 'DESC' },
    });
  }

  async createTemplate(
    actor: AuthenticatedUser,
    dto: CreateKpiTemplateDto,
  ): Promise<KpiTemplate> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const applicableRoleIds = Array.from(
      new Set(dto.applicable_role_ids ?? []),
    );
    if (applicableRoleIds.length) {
      const roles = await this.roleRepository.find({
        where: [
          { id: In(applicableRoleIds), company_id: companyId },
          { id: In(applicableRoleIds), company_id: IsNull() },
        ],
      });
      if (roles.length !== applicableRoleIds.length) {
        throw new BadRequestException(
          'One or more template roles are outside this company.',
        );
      }
    }
    const versions = await this.versionRepository.find({
      where: {
        id: In(dto.items.map((item) => item.kpi_definition_version_id)),
      },
    });

    if (versions.length !== dto.items.length) {
      throw new NotFoundException(
        'One or more KPI definition versions could not be found.',
      );
    }

    assertWeightTotal(
      dto.items.map((item) => item.weight),
      'KPI template',
    );
    assertUniqueValues(
      dto.items.map((item) => item.kpi_definition_version_id),
      'KPI template versions',
    );

    const template = await this.templateRepository.save(
      this.templateRepository.create({
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        status: KpiTemplateStatusEnum.ACTIVE,
        reviewCycle: dto.review_cycle?.trim() ?? null,
        metadata: dto.metadata ?? null,
        applicableRoleIds,
        items: dto.items.map((item) => ({
          kpiDefinitionVersionId: item.kpi_definition_version_id,
          weight: String(item.weight),
          targetValue:
            item.target_value === undefined ? null : String(item.target_value),
          manualEntryAllowed: item.manual_entry_allowed ?? true,
          evidenceRequired: item.evidence_required ?? false,
          notes: item.notes ?? null,
        })),
      }),
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.TEMPLATE_CREATED,
      actor,
      afterValues: {
        kpi_template_id: template.id,
        code: template.code,
      },
    });

    return this.getTemplate(actor, template.id);
  }

  async listTemplates(actor: AuthenticatedUser): Promise<KpiTemplate[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.templateRepository.find({
      where: { companyId },
      relations: { items: true },
      order: { id: 'DESC', items: { id: 'ASC' } },
    });
  }

  async generatePlanFromRules(
    actor: AuthenticatedUser,
    dto: GeneratePerformancePlanFromRulesDto,
  ): Promise<EmployeePerformancePlan> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employee = await this.employeeRepository.findOne({
      where: { id: dto.employee_id, company_id: companyId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const financialYear = await this.financialYearRepository.findOne({
      where: { id: dto.financial_year_id, companyId },
    });

    if (!financialYear) {
      throw new NotFoundException('Performance financial year not found.');
    }

    const items = await this.resolvePlanItems(actor, {
      employee,
      financialYearId: financialYear.id,
      reviewCycle: dto.review_cycle,
    });

    if (items.length === 0) {
      throw new BadRequestException(
        'No KPI applicability rules or templates matched this employee.',
      );
    }

    return this.planService.create(actor, {
      employee_id: employee.id,
      financial_year_id: financialYear.id,
      effective_from: dto.effective_from,
      effective_to: dto.effective_to,
      manager_employee_id: employee.reports_to ?? undefined,
      items,
    });
  }

  private async resolvePlanItems(
    actor: AuthenticatedUser,
    context: ResolvedRuleContext,
  ): Promise<ResolvedPlanItem[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const rules = await this.ruleRepository.find({
      where: {
        companyId,
        status: KpiApplicabilityRuleStatusEnum.ACTIVE,
      },
      order: { priority: 'DESC', id: 'DESC' },
    });

    const matchingRules = rules
      .filter((rule) => this.matches(rule, context))
      .sort((left, right) => {
        const specificityDiff =
          this.specificity(right) - this.specificity(left);
        if (specificityDiff !== 0) {
          return specificityDiff;
        }

        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }

        return right.id - left.id;
      });

    const templateCodes = Array.from(
      new Set(
        matchingRules
          .map((rule) => rule.templateCode)
          .filter((code): code is string => Boolean(code)),
      ),
    );

    const templates = templateCodes.length
      ? await this.templateRepository.find({
          where: {
            companyId,
            code: In(templateCodes),
            status: KpiTemplateStatusEnum.ACTIVE,
          },
          relations: { items: true },
        })
      : [];

    const templateMap = new Map(
      templates.map((template) => [template.code, template]),
    );
    const resolved = new Map<number, ResolvedPlanItem>();

    for (const rule of matchingRules) {
      if (rule.templateCode) {
        const template = templateMap.get(rule.templateCode);
        for (const item of template?.items ?? []) {
          if (!resolved.has(item.kpiDefinitionVersionId)) {
            resolved.set(item.kpiDefinitionVersionId, {
              kpi_definition_version_id: item.kpiDefinitionVersionId,
              weight: Number(item.weight),
              target_value:
                item.targetValue === null
                  ? undefined
                  : Number(item.targetValue),
              manual_entry_allowed: item.manualEntryAllowed,
              evidence_required: item.evidenceRequired,
              notes: item.notes ?? undefined,
            });
          }
        }
      }

      const existing = resolved.get(rule.kpiDefinitionVersionId);
      const nextItem = existing ?? {
        kpi_definition_version_id: rule.kpiDefinitionVersionId,
        weight: 0,
      };

      if (rule.weightOverride !== null) {
        nextItem.weight = Number(rule.weightOverride);
      }

      if (rule.targetOverride !== null) {
        nextItem.target_value = Number(rule.targetOverride);
      }

      resolved.set(rule.kpiDefinitionVersionId, nextItem);
    }

    const unresolvedItems = Array.from(resolved.values()).filter(
      (item) => item.weight > 0,
    );

    if (unresolvedItems.length === 0 && matchingRules.length > 0) {
      const versions = await this.versionRepository.find({
        where: {
          id: In(matchingRules.map((rule) => rule.kpiDefinitionVersionId)),
        },
      });
      for (const [index, version] of versions.entries()) {
        resolved.set(version.id, {
          kpi_definition_version_id: version.id,
          weight:
            (Math.floor(10000 / versions.length) +
              (index < 10000 % versions.length ? 1 : 0)) /
            100,
          target_value:
            version.defaultTargetValue === null
              ? undefined
              : Number(version.defaultTargetValue),
          manual_entry_allowed: version.manualEntryAllowed,
          evidence_required: version.evidenceRequired,
        });
      }
    }

    const planItems = Array.from(resolved.values()).filter(
      (item) => item.weight > 0,
    );
    assertWeightTotal(
      planItems.map((item) => item.weight),
      'Resolved KPI plan',
    );

    return planItems;
  }

  private matches(
    rule: KpiApplicabilityRule,
    context: ResolvedRuleContext,
  ): boolean {
    const employee = context.employee;

    return (
      (rule.financialYearId === null ||
        rule.financialYearId === context.financialYearId) &&
      (rule.branchId === null ||
        rule.branchId === employee.primary_branch_id) &&
      (rule.departmentId === null ||
        rule.departmentId === employee.primary_department_id) &&
      (rule.positionId === null ||
        rule.positionId === employee.primary_position_id) &&
      (rule.gradeId === null || rule.gradeId === employee.grade_id) &&
      (rule.employmentType === null ||
        String(rule.employmentType) === String(employee.employment_type)) &&
      (rule.employeeId === null || rule.employeeId === employee.id) &&
      (rule.reviewCycle === null || rule.reviewCycle === context.reviewCycle)
    );
  }

  private specificity(rule: KpiApplicabilityRule): number {
    return [
      rule.financialYearId,
      rule.branchId,
      rule.departmentId,
      rule.positionId,
      rule.gradeId,
      rule.employmentType,
      rule.employeeId,
      rule.reviewCycle,
      rule.templateCode,
      rule.weightOverride,
      rule.targetOverride,
    ].filter((value) => value !== null).length;
  }

  private async getTemplate(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<KpiTemplate> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const template = await this.templateRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });

    if (!template) {
      throw new NotFoundException('KPI template not found.');
    }

    return template;
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/employee-kpi.service.ts

```typescript
import { assertWeightTotal } from '../utils/workflow-validation';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationCategoryEnum } from '../../../notifications/enums/notification-category.enum';
import { NotificationPriorityEnum } from '../../../notifications/enums/notification-priority.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { EmploymentStatusEnum } from '../../employees/enums/employment-status.enum';
import { HrAccessService } from '../../shared/hr-access.service';
import {
  CreateEmployeeKpiDto,
  CreateAssignedEmployeeKpiDto,
  EmployeeKpiQueryDto,
  ReviewEmployeeKpiDto,
  UpdateEmployeeKpiActualDto,
  UpdateEmployeeKpiDto,
} from '../dto/employee-kpi.dto';
import {
  EmployeeKpi,
  EmployeeKpiReviewHistory,
} from '../entities/employee-kpi.entity';
import { PerformancePeriod } from '../entities/performance-period.entity';
import {
  EmployeeKpiReviewDecisionEnum,
  EmployeeKpiStatusEnum,
} from '../enums/employee-kpi-status.enum';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { PerformancePeriodStatusEnum } from '../enums/performance-period-status.enum';
import { PerformanceAuditService } from './performance-audit.service';
import { EmployeeKpiProgressService } from './employee-kpi-progress.service';
import { kpiCycleToday } from '../utils/kpi-cycle-date';
import {
  KPI_DOMAIN_EVENTS,
  type KpiAssignmentEvent,
} from '../events/kpi-domain-events';

const EDITABLE_STATUSES = [
  EmployeeKpiStatusEnum.DRAFT,
  EmployeeKpiStatusEnum.RETURNED,
];
const REVIEWABLE_STATUSES = [
  EmployeeKpiStatusEnum.SUBMITTED,
  EmployeeKpiStatusEnum.RESUBMITTED,
  EmployeeKpiStatusEnum.PENDING_REVIEW,
];
const CLOSED_PERIOD_STATUSES = [
  PerformancePeriodStatusEnum.LOCKED,
  PerformancePeriodStatusEnum.CANCELLED,
];

@Injectable()
export class EmployeeKpiService {
  private readonly logger = new Logger(EmployeeKpiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    private readonly progressService: EmployeeKpiProgressService,
    private readonly notificationsService: NotificationsService,
    private readonly events: EventEmitter2,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EmployeeKpi)
    private readonly kpiRepository: Repository<EmployeeKpi>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PerformancePeriod)
    private readonly periodRepository: Repository<PerformancePeriod>,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateEmployeeKpiDto) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employeeId = this.requireEmployee(actor);
    const employee = await this.getEmployee(companyId, employeeId);
    const period = await this.getOpenPeriod(
      companyId,
      dto.performance_period_id,
    );
    this.validateKpiDates(period, dto.start_date, dto.due_date);
    this.validateMeasurement(
      dto.measurement_type,
      dto.target_value,
      dto.scoring_type,
    );

    const kpi = await this.dataSource.transaction(async (manager) => {
      const lockedPeriod = await manager
        .getRepository(PerformancePeriod)
        .findOne({
          where: { id: period.id, companyId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedPeriod)
        throw new NotFoundException('Performance period not found.');
      this.assertGoalSettingOpen(lockedPeriod);
      const siblings = await manager.getRepository(EmployeeKpi).find({
        where: { companyId, employeeId, performancePeriodId: period.id },
      });
      if (
        siblings.some(
          (item) =>
            item.status !== EmployeeKpiStatusEnum.REJECTED &&
            item.title.trim().toLocaleLowerCase() ===
              dto.title.trim().toLocaleLowerCase(),
        )
      ) {
        throw new ConflictException(
          'This KPI already exists for the employee in this period.',
        );
      }
      const totalWeight = siblings
        .filter((item) => item.status !== EmployeeKpiStatusEnum.REJECTED)
        .reduce((sum, item) => sum.plus(item.weight), new Decimal(0))
        .plus(dto.weight);
      if (totalWeight.gt(this.maximumWeight(lockedPeriod))) {
        throw new BadRequestException('KPI weights exceed the cycle maximum.');
      }
      const created = await manager.getRepository(EmployeeKpi).save(
        manager.getRepository(EmployeeKpi).create({
          companyId,
          performancePeriodId: period.id,
          employeeId,
          createdByCompanyUserId: actor.companyMembershipId ?? null,
          title: dto.title.trim(),
          description: dto.description.trim(),
          measurementType: dto.measurement_type,
          targetValue:
            dto.target_value === undefined ? null : String(dto.target_value),
          actualValue: null,
          unit: dto.unit?.trim() ?? null,
          weight: String(dto.weight),
          startDate: dto.start_date ?? null,
          dueDate: dto.due_date,
          progressSource: dto.progress_source,
          status: EmployeeKpiStatusEnum.DRAFT,
          reviewerEmployeeId: employee.reports_to,
          submittedAt: null,
          reviewedByCompanyUserId: null,
          reviewedAt: null,
          reviewComment: null,
          scoringType: dto.scoring_type ?? 'NUMERIC_TARGET',
          measurementDirection: dto.measurement_direction ?? 'HIGHER_IS_BETTER',
          formulaConfig: dto.formula_config ?? null,
        }),
      );
      await this.appendHistory(manager, created, actor, null, null);
      return created;
    });
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_CREATED,
      actor,
      employeeId,
      afterValues: this.snapshot(kpi),
    });
    return this.getOwn(actor, kpi.id);
  }

  async assignToEmployee(
    actor: AuthenticatedUser,
    dto: CreateAssignedEmployeeKpiDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employee = await this.getEmployee(companyId, dto.employee_id);
    if (
      actor.employeeId === employee.id &&
      !this.hrAccessService.hasCompanyScope(actor)
    ) {
      throw new ForbiddenException(
        'Managers may assign KPIs only to reportees.',
      );
    }
    const allowedEmployees =
      await this.hrAccessService.getReportingEmployeeIds(actor);
    if (
      !this.hrAccessService.hasCompanyScope(actor) &&
      !allowedEmployees?.includes(employee.id)
    ) {
      throw new ForbiddenException(
        'You may only assign KPIs within your reporting scope.',
      );
    }
    const period = await this.getOpenPeriod(
      companyId,
      dto.performance_period_id,
    );
    this.validateKpiDates(period, dto.start_date, dto.due_date);
    this.validateMeasurement(
      dto.measurement_type,
      dto.target_value,
      dto.scoring_type,
    );

    const kpiId = await this.dataSource.transaction(async (manager) => {
      const lockedPeriod = await manager
        .getRepository(PerformancePeriod)
        .findOne({
          where: { id: period.id, companyId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedPeriod)
        throw new NotFoundException('Performance period not found.');
      this.assertGoalSettingOpen(lockedPeriod);
      const siblings = await manager.getRepository(EmployeeKpi).find({
        where: {
          companyId,
          employeeId: employee.id,
          performancePeriodId: period.id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const duplicate = siblings.some(
        (item) =>
          item.title.trim().toLocaleLowerCase() ===
            dto.title.trim().toLocaleLowerCase() &&
          item.status !== EmployeeKpiStatusEnum.REJECTED,
      );
      if (duplicate)
        throw new ConflictException(
          'This KPI already exists for the employee in this period.',
        );
      const assignedWeight = siblings
        .filter((item) => item.status !== EmployeeKpiStatusEnum.REJECTED)
        .reduce((sum, item) => sum.plus(item.weight), new Decimal(0));
      const maxWeight = this.maximumWeight(lockedPeriod);
      if (assignedWeight.plus(dto.weight).gt(maxWeight)) {
        throw new BadRequestException(
          `KPI weights cannot exceed ${maxWeight.toString()} for this period.`,
        );
      }

      const created = await manager.getRepository(EmployeeKpi).save(
        manager.getRepository(EmployeeKpi).create({
          companyId,
          performancePeriodId: period.id,
          employeeId: employee.id,
          createdByCompanyUserId: actor.companyMembershipId ?? null,
          title: dto.title.trim(),
          description: dto.description.trim(),
          measurementType: dto.measurement_type,
          targetValue:
            dto.target_value === undefined ? null : String(dto.target_value),
          actualValue: null,
          unit: dto.unit?.trim() ?? null,
          weight: String(dto.weight),
          startDate: dto.start_date ?? null,
          dueDate: dto.due_date,
          progressSource: dto.progress_source,
          status: EmployeeKpiStatusEnum.SUBMITTED,
          reviewerEmployeeId: actor.employeeId ?? null,
          submittedAt: new Date(),
          reviewedByCompanyUserId: null,
          reviewedAt: null,
          reviewComment: null,
          scoringType: dto.scoring_type ?? 'NUMERIC_TARGET',
          measurementDirection: dto.measurement_direction ?? 'HIGHER_IS_BETTER',
          formulaConfig: dto.formula_config ?? null,
        }),
      );
      await this.appendHistory(manager, created, actor, null, null);
      return created.id;
    });
    const kpi = await this.kpiRepository.findOneByOrFail({
      id: kpiId,
      companyId,
    });
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_ASSIGNED,
      actor,
      employeeId: employee.id,
      afterValues: this.snapshot(kpi),
    });
    this.emitAssignment(KPI_DOMAIN_EVENTS.ASSIGNED, kpi);
    return this.getTeamOne(actor, kpi.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdateEmployeeKpiDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employeeId = this.requireEmployee(actor);
    const kpi = await this.kpiRepository.findOne({
      where: { id, companyId, employeeId },
      relations: { performancePeriod: true },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    if (!EDITABLE_STATUSES.includes(kpi.status)) {
      throw new ConflictException('Only draft or returned KPIs can be edited.');
    }
    this.assertGoalSettingOpen(kpi.performancePeriod);
    if (
      dto.performance_period_id !== undefined &&
      dto.performance_period_id !== kpi.performancePeriodId
    ) {
      throw new BadRequestException('A KPI cannot be moved to another period.');
    }
    if (dto.weight !== undefined) {
      const siblings = await this.kpiRepository.find({
        where: {
          companyId,
          employeeId,
          performancePeriodId: kpi.performancePeriodId,
        },
      });
      const maxWeight = this.maximumWeight(kpi.performancePeriod);
      const proposedTotal = siblings
        .filter(
          (item) =>
            item.id !== kpi.id &&
            item.status !== EmployeeKpiStatusEnum.REJECTED,
        )
        .reduce((sum, item) => sum.plus(item.weight), new Decimal(0))
        .plus(dto.weight);
      if (proposedTotal.gt(maxWeight)) {
        throw new BadRequestException(
          `KPI weights cannot exceed ${maxWeight.toString()} for this period.`,
        );
      }
    }
    const startDate = dto.start_date ?? kpi.startDate ?? undefined;
    const dueDate = dto.due_date ?? kpi.dueDate;
    this.validateKpiDates(kpi.performancePeriod, startDate, dueDate);
    this.validateMeasurement(
      dto.measurement_type ?? kpi.measurementType,
      dto.target_value ??
        (kpi.targetValue === null ? undefined : Number(kpi.targetValue)),
      dto.scoring_type ?? kpi.scoringType,
    );
    const before = this.snapshot(kpi);
    kpi.title = dto.title?.trim() ?? kpi.title;
    kpi.description = dto.description?.trim() ?? kpi.description;
    kpi.measurementType = dto.measurement_type ?? kpi.measurementType;
    if (dto.target_value !== undefined)
      kpi.targetValue = String(dto.target_value);
    if (dto.unit !== undefined) kpi.unit = dto.unit.trim() || null;
    if (dto.weight !== undefined) kpi.weight = String(dto.weight);
    if (dto.start_date !== undefined) kpi.startDate = dto.start_date;
    if (dto.due_date !== undefined) kpi.dueDate = dto.due_date;
    if (dto.progress_source !== undefined)
      kpi.progressSource = dto.progress_source;
    if (dto.scoring_type !== undefined) kpi.scoringType = dto.scoring_type;
    if (dto.measurement_direction !== undefined)
      kpi.measurementDirection = dto.measurement_direction;
    if (dto.formula_config !== undefined)
      kpi.formulaConfig = dto.formula_config;
    const saved = await this.kpiRepository.save(kpi);
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_UPDATED,
      actor,
      employeeId,
      beforeValues: before,
      afterValues: this.snapshot(saved),
    });
    return this.getOwn(actor, saved.id);
  }

  async remove(actor: AuthenticatedUser, id: number) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employeeId = this.requireEmployee(actor);
    const kpi = await this.kpiRepository.findOne({
      where: { id, companyId, employeeId },
      relations: { performancePeriod: true },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    if (!EDITABLE_STATUSES.includes(kpi.status)) {
      throw new ConflictException(
        'Only draft or returned KPIs can be deleted.',
      );
    }
    this.assertGoalSettingOpen(kpi.performancePeriod);

    const snapshot = this.snapshot(kpi);
    await this.kpiRepository.remove(kpi);
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_DELETED,
      actor,
      employeeId,
      beforeValues: snapshot,
      afterValues: { deleted: true, employee_kpi_id: id },
    });
    return { id, deleted: true };
  }

  async submitPeriod(actor: AuthenticatedUser, performancePeriodId: number) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employeeId = this.requireEmployee(actor);
    const submittedIds = await this.dataSource.transaction(async (manager) => {
      const period = await manager.getRepository(PerformancePeriod).findOne({
        where: { id: performancePeriodId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!period) throw new NotFoundException('Performance period not found.');
      this.assertGoalSettingOpen(period);
      const kpis = await manager.getRepository(EmployeeKpi).find({
        where: { companyId, employeeId, performancePeriodId },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const candidates = kpis.filter((kpi) =>
        EDITABLE_STATUSES.includes(kpi.status),
      );
      if (candidates.length === 0) {
        throw new ConflictException(
          'There are no draft or returned KPIs to submit.',
        );
      }
      const included = kpis.filter(
        (kpi) => kpi.status !== EmployeeKpiStatusEnum.REJECTED,
      );
      this.validateWeightTotal(included, period);
      const now = new Date();
      for (const kpi of candidates) {
        const fromStatus = kpi.status;
        kpi.status =
          fromStatus === EmployeeKpiStatusEnum.RETURNED
            ? EmployeeKpiStatusEnum.RESUBMITTED
            : EmployeeKpiStatusEnum.SUBMITTED;
        kpi.submittedAt = now;
        await manager.getRepository(EmployeeKpi).save(kpi);
        await this.appendHistory(manager, kpi, actor, fromStatus, null);
      }
      return candidates.map((kpi) => kpi.id);
    });

    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_SUBMITTED,
      actor,
      employeeId,
      afterValues: {
        performance_period_id: performancePeriodId,
        employee_kpi_ids: submittedIds,
      },
    });
    for (const id of submittedIds)
      this.events.emit(KPI_DOMAIN_EVENTS.PROPOSAL_SUBMITTED, {
        companyId,
        cycleId: performancePeriodId,
        employeeId,
        employeeKpiId: id,
        occurredAt: new Date().toISOString(),
      } satisfies KpiAssignmentEvent);
    const employee = await this.getEmployee(companyId, employeeId);
    void this.notifyManager(actor, employee, performancePeriodId, submittedIds);
    return this.listOwn(actor, { performance_period_id: performancePeriodId });
  }

  async markPendingReview(actor: AuthenticatedUser, id: number) {
    const transition = await this.dataSource.transaction(async (manager) => {
      const kpi = await this.lockReviewable(manager, actor, id);
      const fromStatus = kpi.status;
      if (fromStatus === EmployeeKpiStatusEnum.PENDING_REVIEW) {
        return { saved: kpi, changed: false };
      }
      kpi.status = EmployeeKpiStatusEnum.PENDING_REVIEW;
      const saved = await manager.getRepository(EmployeeKpi).save(kpi);
      await this.appendHistory(manager, saved, actor, fromStatus, null);
      return { saved, changed: true };
    });
    if (transition.changed) {
      await this.auditService.log({
        action: PerformanceAuditActionEnum.EMPLOYEE_KPI_REVIEW_STARTED,
        actor,
        employeeId: transition.saved.employeeId,
        afterValues: this.snapshot(transition.saved),
      });
    }
    return this.withProgress(transition.saved);
  }

  async review(
    actor: AuthenticatedUser,
    id: number,
    dto: ReviewEmployeeKpiDto,
  ) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const kpi = await this.lockReviewable(manager, actor, id);
      if (
        [
          EmployeeKpiReviewDecisionEnum.RETURN,
          EmployeeKpiReviewDecisionEnum.REJECT,
        ].includes(dto.decision) &&
        !dto.comment?.trim()
      ) {
        throw new BadRequestException(
          'A comment is required for return or rejection.',
        );
      }
      if (dto.decision === EmployeeKpiReviewDecisionEnum.APPROVE) {
        const periodKpis = await manager.getRepository(EmployeeKpi).find({
          where: {
            companyId: kpi.companyId,
            employeeId: kpi.employeeId,
            performancePeriodId: kpi.performancePeriodId,
          },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        const included = periodKpis.filter(
          (item) =>
            item.id === kpi.id ||
            ![
              EmployeeKpiStatusEnum.REJECTED,
              EmployeeKpiStatusEnum.RETURNED,
            ].includes(item.status),
        );
        this.validateWeightTotal(included, kpi.performancePeriod);
      }
      let fromStatus = kpi.status;
      if (fromStatus !== EmployeeKpiStatusEnum.PENDING_REVIEW) {
        kpi.status = EmployeeKpiStatusEnum.PENDING_REVIEW;
        const pending = await manager.getRepository(EmployeeKpi).save(kpi);
        await this.appendHistory(manager, pending, actor, fromStatus, null);
        fromStatus = EmployeeKpiStatusEnum.PENDING_REVIEW;
      }
      switch (dto.decision) {
        case EmployeeKpiReviewDecisionEnum.APPROVE:
          kpi.status = EmployeeKpiStatusEnum.APPROVED;
          break;
        case EmployeeKpiReviewDecisionEnum.RETURN:
          kpi.status = EmployeeKpiStatusEnum.RETURNED;
          break;
        case EmployeeKpiReviewDecisionEnum.REJECT:
          kpi.status = EmployeeKpiStatusEnum.REJECTED;
          break;
      }
      kpi.reviewedByCompanyUserId = actor.companyMembershipId ?? null;
      kpi.reviewedAt = new Date();
      kpi.reviewComment = dto.comment?.trim() ?? null;
      const result = await manager.getRepository(EmployeeKpi).save(kpi);
      await this.appendHistory(manager, result, actor, fromStatus, dto);
      return result;
    });
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_REVIEWED,
      actor,
      employeeId: saved.employeeId,
      afterValues: this.snapshot(saved),
      reason: dto.comment?.trim() ?? null,
    });
    void this.notifyEmployee(actor, saved);
    if (saved.status === EmployeeKpiStatusEnum.APPROVED) {
      this.emitAssignment(KPI_DOMAIN_EVENTS.PROPOSAL_APPROVED, saved);
      this.emitAssignment(KPI_DOMAIN_EVENTS.APPROVED, saved);
      this.emitAssignment(KPI_DOMAIN_EVENTS.LOCKED, saved);
    }
    return this.getTeamOne(actor, saved.id);
  }

  private emitAssignment(event: string, kpi: EmployeeKpi): void {
    this.events.emit(event, {
      companyId: kpi.companyId,
      cycleId: kpi.performancePeriodId,
      employeeId: kpi.employeeId,
      employeeKpiId: kpi.id,
      occurredAt: new Date().toISOString(),
    } satisfies KpiAssignmentEvent);
  }

  async updateActual(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdateEmployeeKpiActualDto,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employeeId = this.requireEmployee(actor);
    const kpi = await this.kpiRepository.findOne({
      where: { id, companyId, employeeId },
      relations: { performancePeriod: true },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    if (kpi.status !== EmployeeKpiStatusEnum.APPROVED) {
      throw new ConflictException('Only an approved KPI can record progress.');
    }
    if (CLOSED_PERIOD_STATUSES.includes(kpi.performancePeriod.status)) {
      throw new ConflictException('The performance period is closed.');
    }
    if (['LOCKED', 'CLOSED'].includes(kpi.performancePeriod.kpiPhase ?? '')) {
      throw new ConflictException('The KPI cycle is locked.');
    }
    const before = kpi.actualValue;
    kpi.actualValue = String(dto.actual_value);
    const saved = await this.kpiRepository.save(kpi);
    await this.auditService.log({
      action: PerformanceAuditActionEnum.EMPLOYEE_KPI_ACTUAL_UPDATED,
      actor,
      employeeId,
      beforeValues: { actual_value: before },
      afterValues: { actual_value: saved.actualValue },
    });
    return this.withProgress(saved);
  }

  async listOwn(actor: AuthenticatedUser, query: EmployeeKpiQueryDto) {
    return this.listScoped(actor, query, this.requireEmployee(actor));
  }

  async listTeam(actor: AuthenticatedUser, query: EmployeeKpiQueryDto) {
    return this.listScoped(actor, query, null);
  }

  async listAssignableEmployees(actor: AuthenticatedUser) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const reporteeIds = this.hrAccessService.hasCompanyScope(actor)
      ? null
      : await this.hrAccessService.getReportingEmployeeIds(actor);
    if (reporteeIds !== null && !reporteeIds.length) return [];
    const employees = await this.employeeRepository.find({
      where: {
        company_id: companyId,
        employment_status: EmploymentStatusEnum.ACTIVE,
        ...(reporteeIds === null ? {} : { id: In(reporteeIds) }),
      },
      order: { first_name: 'ASC', last_name: 'ASC' },
    });
    return employees.map((employee) => ({
      id: employee.id,
      full_name: [employee.first_name, employee.middle_name, employee.last_name]
        .filter(Boolean)
        .join(' '),
      employee_no: employee.employee_no,
    }));
  }

  async getOwn(actor: AuthenticatedUser, id: number) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const kpi = await this.kpiRepository.findOne({
      where: { id, companyId, employeeId: this.requireEmployee(actor) },
      relations: { performancePeriod: true, reviewHistory: true },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    return this.withProgress(kpi);
  }

  async getTeamOne(actor: AuthenticatedUser, id: number) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const kpi = await this.kpiRepository.findOne({
      where: { id, companyId },
      relations: {
        employee: true,
        reviewer: true,
        performancePeriod: true,
        reviewHistory: true,
      },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    await this.assertReviewer(actor, kpi);
    return this.withProgress(kpi);
  }

  private async listScoped(
    actor: AuthenticatedUser,
    query: EmployeeKpiQueryDto,
    ownEmployeeId: number | null,
  ) {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const qb = this.kpiRepository
      .createQueryBuilder('kpi')
      .leftJoinAndSelect('kpi.employee', 'employee')
      .leftJoinAndSelect('kpi.performancePeriod', 'period')
      .where('kpi.companyId = :companyId', { companyId });
    if (ownEmployeeId !== null) {
      qb.andWhere('kpi.employeeId = :ownEmployeeId', { ownEmployeeId });
    } else if (!this.hrAccessService.hasCompanyScope(actor)) {
      const accessibleIds =
        await this.hrAccessService.getReportingEmployeeIds(actor);
      if (!accessibleIds?.length) {
        return { data: [], meta: this.meta(page, limit, 0) };
      }
      qb.andWhere('kpi.employeeId IN (:...accessibleIds)', { accessibleIds });
    }
    if (query.performance_period_id) {
      qb.andWhere('kpi.performancePeriodId = :periodId', {
        periodId: query.performance_period_id,
      });
    }
    if (query.employee_id)
      qb.andWhere('kpi.employeeId = :employeeId', {
        employeeId: query.employee_id,
      });
    if (query.department_id)
      qb.andWhere('employee.primary_department_id = :departmentId', {
        departmentId: query.department_id,
      });
    if (query.status)
      qb.andWhere('kpi.status = :status', { status: query.status });
    if (query.reviewer_employee_id)
      qb.andWhere('kpi.reviewerEmployeeId = :reviewerId', {
        reviewerId: query.reviewer_employee_id,
      });
    if (query.search?.trim()) {
      qb.andWhere(
        '(LOWER(kpi.title) LIKE :search OR LOWER(kpi.description) LIKE :search)',
        {
          search: `%${query.search.trim().toLowerCase()}%`,
        },
      );
    }
    const [items, total] = await qb
      .orderBy('kpi.updatedAt', 'DESC')
      .addOrderBy('kpi.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      data: await Promise.all(items.map((item) => this.withProgress(item))),
      meta: this.meta(page, limit, total),
    };
  }

  private async lockReviewable(
    manager: EntityManager,
    actor: AuthenticatedUser,
    id: number,
  ): Promise<EmployeeKpi> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const kpi = await manager.getRepository(EmployeeKpi).findOne({
      where: { id, companyId },
      relations: { performancePeriod: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!kpi) throw new NotFoundException('Employee KPI not found.');
    await this.assertReviewer(actor, kpi);
    if (!REVIEWABLE_STATUSES.includes(kpi.status)) {
      throw new ConflictException('The KPI is not awaiting review.');
    }
    if (CLOSED_PERIOD_STATUSES.includes(kpi.performancePeriod.status)) {
      throw new ConflictException('The performance period is closed.');
    }
    return kpi;
  }

  private async assertReviewer(actor: AuthenticatedUser, kpi: EmployeeKpi) {
    if (this.hrAccessService.hasCompanyScope(actor)) return;
    const accessible =
      await this.hrAccessService.getReportingEmployeeIds(actor);
    if (accessible?.includes(kpi.employeeId)) return;
    throw new ForbiddenException(
      'You are not authorized to review this employee KPI.',
    );
  }

  private maximumWeight(period: PerformancePeriod): Decimal {
    return new Decimal(
      period.kpiPhase
        ? period.maxWeightage
        : this.configService.get<number>(
            'PERFORMANCE_MAXIMUM_WEIGHT_TOTAL',
            100,
          ),
    );
  }

  private validateWeightTotal(
    kpis: EmployeeKpi[],
    period: PerformancePeriod,
  ): void {
    const total = kpis.reduce(
      (sum, kpi) => sum.plus(kpi.weight),
      new Decimal(0),
    );
    const maximum = this.maximumWeight(period);
    assertWeightTotal(
      kpis.map((kpi) => Number(kpi.weight)),
      'Employee KPI set',
    );
    if (total.gt(maximum)) {
      throw new BadRequestException(
        `The KPI set totals 100%, but this cycle permits only ${maximum.toString()}%. Ask HR to correct the cycle maximum before submission.`,
      );
    }
  }

  private validateKpiDates(
    period: PerformancePeriod,
    startDate: string | undefined,
    dueDate: string,
  ) {
    if (startDate && startDate > dueDate) {
      throw new BadRequestException(
        'due_date must not be earlier than start_date.',
      );
    }
    if (
      (startDate && startDate < period.startDate) ||
      dueDate < period.startDate ||
      dueDate > period.endDate
    ) {
      throw new BadRequestException(
        'KPI dates must fall within the performance period.',
      );
    }
  }

  private validateMeasurement(
    type: string,
    targetValue?: number,
    scoringType?: string,
  ) {
    if (
      type !== 'MANUAL' &&
      scoringType !== 'RATING_SCALE' &&
      targetValue === undefined
    ) {
      throw new BadRequestException(
        'target_value is required for this measurement type.',
      );
    }
  }

  private async getOpenPeriod(companyId: number, id: number) {
    const period = await this.periodRepository.findOne({
      where: { id, companyId },
    });
    if (!period) throw new NotFoundException('Performance period not found.');
    this.assertGoalSettingOpen(period);
    return period;
  }

  private assertGoalSettingOpen(period: PerformancePeriod): void {
    if (period.status !== PerformancePeriodStatusEnum.OPEN) {
      throw new ConflictException(
        'KPIs can only be changed in an open period.',
      );
    }
    if (!period.kpiPhase || period.kpiPhase === 'REOPENED') return;
    const today = kpiCycleToday();
    if (
      period.kpiPhase !== 'GOAL_SETTING' ||
      today < period.startDate ||
      !period.goalSettingDeadline ||
      today > period.goalSettingDeadline
    ) {
      throw new ConflictException('The KPI goal-setting window is closed.');
    }
  }

  private async getEmployee(companyId: number, id: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id, company_id: companyId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    return employee;
  }

  private requireEmployee(actor: AuthenticatedUser): number {
    if (!actor.employeeId)
      throw new ForbiddenException('Employee profile is required.');
    return actor.employeeId;
  }

  private async appendHistory(
    manager: EntityManager,
    kpi: EmployeeKpi,
    actor: AuthenticatedUser,
    fromStatus: EmployeeKpiStatusEnum | null,
    review: ReviewEmployeeKpiDto | null,
  ) {
    await manager.getRepository(EmployeeKpiReviewHistory).save(
      manager.getRepository(EmployeeKpiReviewHistory).create({
        companyId: kpi.companyId,
        employeeKpiId: kpi.id,
        actorCompanyUserId: actor.companyMembershipId ?? null,
        actorEmployeeId: actor.employeeId ?? null,
        fromStatus,
        toStatus: kpi.status,
        decision: review?.decision ?? null,
        comment: review?.comment?.trim() ?? null,
        snapshot: this.snapshot(kpi),
      }),
    );
  }

  private async withProgress(kpi: EmployeeKpi) {
    return { ...kpi, progress: await this.progressService.calculate(kpi) };
  }

  private snapshot(kpi: EmployeeKpi) {
    return {
      id: kpi.id,
      performance_period_id: kpi.performancePeriodId,
      employee_id: kpi.employeeId,
      title: kpi.title,
      measurement_type: kpi.measurementType,
      target_value: kpi.targetValue,
      actual_value: kpi.actualValue,
      weight: kpi.weight,
      status: kpi.status,
      reviewer_employee_id: kpi.reviewerEmployeeId,
      version: kpi.version,
    };
  }

  private meta(page: number, limit: number, total: number) {
    return { page, limit, total, total_pages: Math.ceil(total / limit) };
  }

  private async notifyManager(
    actor: AuthenticatedUser,
    employee: Employee,
    periodId: number,
    kpiIds: number[],
  ) {
    try {
      if (!employee.reports_to) return;
      const manager = await this.getEmployee(
        employee.company_id,
        employee.reports_to,
      );
      if (!manager.company_user_id) return;
      await this.notificationsService.createAndPush({
        company_id: employee.company_id,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: manager.company_user_id,
        category: NotificationCategoryEnum.HR,
        priority: NotificationPriorityEnum.MEDIUM,
        title: 'KPIs awaiting review',
        message: `${employee.first_name} ${employee.last_name} submitted ${kpiIds.length} KPI${kpiIds.length === 1 ? '' : 's'} for review.`,
        related_module: 'PERFORMANCE',
        entity_type: 'PERFORMANCE_PERIOD',
        entity_id: periodId,
        action_url: '/dashboard/me/performance/kpi-reviews',
        dedupe_key: `employee-kpis-submitted:${periodId}:${employee.id}:${kpiIds.join('-')}`,
      });
    } catch (error) {
      this.logger.warn(
        `KPI submission notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyEmployee(actor: AuthenticatedUser, kpi: EmployeeKpi) {
    try {
      const employee = await this.getEmployee(kpi.companyId, kpi.employeeId);
      if (!employee.company_user_id) return;
      await this.notificationsService.createAndPush({
        company_id: kpi.companyId,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: employee.company_user_id,
        category: NotificationCategoryEnum.HR,
        priority:
          kpi.status === EmployeeKpiStatusEnum.APPROVED
            ? NotificationPriorityEnum.MEDIUM
            : NotificationPriorityEnum.HIGH,
        title: `KPI ${kpi.status.toLowerCase().replaceAll('_', ' ')}`,
        message: kpi.reviewComment
          ? `${kpi.title}: ${kpi.reviewComment}`
          : `${kpi.title} was ${kpi.status.toLowerCase()}.`,
        related_module: 'PERFORMANCE',
        entity_type: 'EMPLOYEE_KPI',
        entity_id: kpi.id,
        action_url: '/dashboard/me/performance/kpis',
        dedupe_key: `employee-kpi-review:${kpi.id}:${kpi.version}`,
      });
    } catch (error) {
      this.logger.warn(
        `KPI review notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-plan.service.ts

```typescript
import {
  assertDateRange,
  assertWeightTotal,
  assertUniqueValues,
} from '../utils/workflow-validation';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { HrAccessService } from '../../shared/hr-access.service';
import { Employee } from '../../employees/entities/employee.entity';
import { EmploymentStatusEnum } from '../../employees/enums/employment-status.enum';
import { CreatePerformancePlanDto } from '../dto/create-performance-plan.dto';
import { EmployeePerformancePlan } from '../entities/employee-performance-plan.entity';
import { EmployeePerformancePlanItem } from '../entities/employee-performance-plan-item.entity';
import { KpiAchievement } from '../entities/kpi-achievement.entity';
import { KpiDefinitionVersion } from '../entities/kpi-definition-version.entity';
import { PerformanceFinancialYear } from '../entities/performance-financial-year.entity';
import { PerformancePeriod } from '../entities/performance-period.entity';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { KpiAchievementStatusEnum } from '../enums/kpi-achievement-status.enum';
import { PerformancePeriodAssignmentStatusEnum } from '../enums/performance-period-assignment-status.enum';
import { PerformancePlanStatusEnum } from '../enums/performance-plan-status.enum';
import { PerformanceAuditService } from './performance-audit.service';

@Injectable()
export class PerformancePlanService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PerformanceFinancialYear)
    private readonly financialYearRepository: Repository<PerformanceFinancialYear>,
    @InjectRepository(KpiDefinitionVersion)
    private readonly definitionVersionRepository: Repository<KpiDefinitionVersion>,
    @InjectRepository(EmployeePerformancePlan)
    private readonly planRepository: Repository<EmployeePerformancePlan>,
    @InjectRepository(EmployeePerformancePlanItem)
    private readonly planItemRepository: Repository<EmployeePerformancePlanItem>,
    @InjectRepository(PerformancePeriod)
    private readonly periodRepository: Repository<PerformancePeriod>,
    @InjectRepository(PerformancePeriodAssignment)
    private readonly periodAssignmentRepository: Repository<PerformancePeriodAssignment>,
    @InjectRepository(KpiAchievement)
    private readonly achievementRepository: Repository<KpiAchievement>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreatePerformancePlanDto,
  ): Promise<EmployeePerformancePlan> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const employee = await this.employeeRepository.findOne({
      where: {
        id: dto.employee_id,
        company_id: companyId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    if (employee.employment_status !== EmploymentStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'Only active employees can receive a performance plan.',
      );
    }

    const financialYear = await this.financialYearRepository.findOne({
      where: {
        id: dto.financial_year_id,
        companyId,
      },
    });

    if (!financialYear) {
      throw new NotFoundException('Performance financial year not found.');
    }

    assertDateRange(dto.effective_from, dto.effective_to, 'Performance plan');
    if (
      dto.effective_from < financialYear.startDate ||
      dto.effective_from > financialYear.endDate ||
      (dto.effective_to && dto.effective_to > financialYear.endDate)
    ) {
      throw new BadRequestException(
        'Plan effective dates must be inside the selected financial year.',
      );
    }
    assertWeightTotal(
      dto.items.map((item) => item.weight),
      'Performance plan KPI',
    );
    assertUniqueValues(
      dto.items.map((item) => item.kpi_definition_version_id),
      'Performance plan KPI versions',
    );
    const totalWeight = dto.items.reduce((sum, item) => sum + item.weight, 0);

    const activePlan = await this.planRepository.findOne({
      where: {
        companyId,
        employeeId: employee.id,
        financialYearId: financialYear.id,
        status: PerformancePlanStatusEnum.ACTIVE,
      },
    });

    if (activePlan) {
      throw new ConflictException(
        'An active performance plan already exists for this employee and financial year.',
      );
    }

    const definitionVersions = await this.definitionVersionRepository.find({
      where: {
        id: In(dto.items.map((item) => item.kpi_definition_version_id)),
      },
    });
    const definitionVersionMap = new Map(
      definitionVersions.map((item) => [item.id, item]),
    );

    if (definitionVersions.length !== dto.items.length) {
      throw new NotFoundException(
        'One or more KPI definition versions could not be found.',
      );
    }

    const snapshot = {
      employee_id: employee.id,
      employee_no: employee.employee_no,
      first_name: employee.first_name,
      last_name: employee.last_name,
      branch_id: employee.primary_branch_id,
      department_id: employee.primary_department_id,
      position_id: employee.primary_position_id,
      grade_id: employee.grade_id,
      manager_employee_id: dto.manager_employee_id ?? employee.reports_to,
    };
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({ snapshot, items: dto.items }))
      .digest('hex');

    const plan = await this.planRepository.save(
      this.planRepository.create({
        companyId,
        employeeId: employee.id,
        financialYearId: financialYear.id,
        versionNumber: 1,
        status: PerformancePlanStatusEnum.ACTIVE,
        effectiveFrom: dto.effective_from,
        effectiveTo: dto.effective_to ?? null,
        managerEmployeeId: dto.manager_employee_id ?? employee.reports_to,
        managerCompanyUserId: null,
        employeeSnapshot: snapshot,
        assignmentSnapshotHash: snapshotHash,
        assignedAt: new Date(),
        assignedByCompanyUserId: actor.companyMembershipId ?? null,
        items: dto.items.map((item) => {
          const definitionVersion = definitionVersionMap.get(
            item.kpi_definition_version_id,
          )!;
          return this.planItemRepository.create({
            kpiDefinitionVersionId: definitionVersion.id,
            weight: String(item.weight),
            targetValue:
              item.target_value === undefined
                ? null
                : String(item.target_value),
            manualEntryAllowed:
              item.manual_entry_allowed ?? definitionVersion.manualEntryAllowed,
            evidenceRequired:
              item.evidence_required ?? definitionVersion.evidenceRequired,
            notes: item.notes ?? null,
            kpiSnapshot: {
              kpi_definition_id: definitionVersion.kpiDefinitionId,
              kpi_definition_version_id: definitionVersion.id,
              version_number: definitionVersion.versionNumber,
              measurement_unit: definitionVersion.measurementUnit,
              measurement_direction: definitionVersion.measurementDirection,
              scoring_formula: definitionVersion.scoringFormula,
              formula_configuration: definitionVersion.formulaConfiguration,
              data_source_type: definitionVersion.dataSourceType,
            },
          });
        }),
      }),
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.PLAN_ASSIGNED,
      actor,
      employeeId: employee.id,
      afterValues: {
        performance_plan_id: plan.id,
        total_weight: totalWeight,
      },
    });

    return this.get(actor, plan.id);
  }

  async createAssignmentsForPeriod(
    actor: AuthenticatedUser,
    performancePeriodId: number,
  ): Promise<PerformancePeriodAssignment[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const period = await this.periodRepository.findOne({
      where: { id: performancePeriodId, companyId },
    });

    if (!period) {
      throw new NotFoundException('Performance period not found.');
    }

    const plans = await this.planRepository.find({
      where: {
        companyId,
        financialYearId: period.financialYearId,
        status: PerformancePlanStatusEnum.ACTIVE,
      },
      relations: {
        items: {
          kpiDefinitionVersion: true,
        },
      },
      order: { id: 'ASC' },
    });

    const existingAssignments = await this.periodAssignmentRepository.find({
      where: { performancePeriodId },
    });
    const assignedEmployeeIds = new Set(
      existingAssignments.map((assignment) => assignment.employeeId),
    );

    const createdAssignments: PerformancePeriodAssignment[] = [];

    for (const plan of plans) {
      if (assignedEmployeeIds.has(plan.employeeId)) {
        continue;
      }

      const totalWeight = plan.items.reduce(
        (sum, item) => sum + Number(item.weight),
        0,
      );

      const assignment = await this.periodAssignmentRepository.save(
        this.periodAssignmentRepository.create({
          companyId,
          performancePeriodId: period.id,
          employeeId: plan.employeeId,
          performancePlanId: plan.id,
          managerEmployeeId: plan.managerEmployeeId,
          managerCompanyUserId: plan.managerCompanyUserId,
          status: PerformancePeriodAssignmentStatusEnum.OPEN,
          employeeSnapshot: plan.employeeSnapshot,
          planSnapshot: {
            performance_plan_id: plan.id,
            performance_plan_version_number: plan.versionNumber,
            assignment_snapshot_hash: plan.assignmentSnapshotHash,
          },
          totalWeight: String(totalWeight),
        }),
      );

      const achievements = plan.items.map((item) =>
        this.achievementRepository.create({
          companyId,
          periodAssignmentId: assignment.id,
          planItemId: item.id,
          employeeId: plan.employeeId,
          targetValue: item.targetValue,
          achievementValue: null,
          rawScore: null,
          cappedScore: null,
          weightedScore: null,
          status: KpiAchievementStatusEnum.NOT_STARTED,
          sourceType: item.kpiDefinitionVersion.dataSourceType,
          achievementSnapshot: {
            kpi_snapshot: item.kpiSnapshot,
            weight: item.weight,
            target_value: item.targetValue,
          },
          evidence: null,
        }),
      );

      await this.achievementRepository.save(achievements);
      createdAssignments.push(assignment);
    }

    await this.auditService.log({
      action: PerformanceAuditActionEnum.ASSIGNMENT_CREATED,
      actor,
      afterValues: {
        performance_period_id: period.id,
        created_assignments: createdAssignments.map(
          (assignment) => assignment.id,
        ),
      },
    });

    return this.periodAssignmentRepository.find({
      where: { performancePeriodId: period.id },
      order: { id: 'ASC' },
    });
  }

  async list(actor: AuthenticatedUser): Promise<EmployeePerformancePlan[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.planRepository.find({
      where: { companyId },
      relations: { items: true },
      order: { id: 'DESC', items: { id: 'ASC' } },
    });
  }

  async listAssignmentsForEmployee(
    actor: AuthenticatedUser,
    employeeId: number,
  ): Promise<PerformancePeriodAssignment[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.periodAssignmentRepository.find({
      where: { companyId, employeeId },
      relations: { performancePeriod: true },
      order: { id: 'DESC' },
    });
  }

  async get(
    actor: AuthenticatedUser,
    id: number,
  ): Promise<EmployeePerformancePlan> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const plan = await this.planRepository.findOne({
      where: { id, companyId },
      relations: {
        items: {
          kpiDefinitionVersion: true,
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Performance plan not found.');
    }

    return plan;
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.lifecycle.spec.ts

```typescript
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { HrAccessService } from '../../shared/hr-access.service';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformanceCompetencyService } from './performance-competency.service';
import { PerformanceImprovementPlanService } from './performance-improvement-plan.service';
import { PerformanceScorecardService } from './performance-scorecard.service';
import { PerformanceWorkflowService } from './performance-workflow.service';
import { KpiAchievement } from '../entities/kpi-achievement.entity';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import { PerformancePeriod } from '../entities/performance-period.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import { PerformanceRatingScale } from '../entities/performance-rating-scale.entity';
import { PerformanceReviewModeration } from '../entities/performance-review-moderation.entity';
import { PerformanceAppeal } from '../entities/performance-appeal.entity';
import { PerformanceReviewStatusEnum } from '../enums/performance-review-status.enum';

const actor: AuthenticatedUser = {
  id: 1,
  email: 'employee@example.test',
  scope: 'company',
  userType: 'COMPANY_USER',
  companyId: 1,
  companyMembershipId: 1,
  employeeId: 10,
  roles: [],
  permissions: [],
};

async function harness(status: PerformanceReviewStatusEnum, closed = false) {
  const assignment = {
    id: 7,
    companyId: 1,
    performancePeriodId: 5,
    employeeId: 10,
    managerEmployeeId: 10,
  };
  const review = {
    id: 8,
    companyId: 1,
    employeeId: 10,
    periodAssignmentId: 7,
    status,
  };
  const assignmentRepository = {
    findOne: jest.fn().mockResolvedValue(assignment),
    save: jest.fn(async (value: unknown) => value),
  };
  const reviewRepository = {
    findOne: jest.fn().mockResolvedValue(review),
    save: jest.fn(async (value: unknown) => value),
    manager: { transaction: jest.fn() },
  };
  const periodRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 5,
      companyId: 1,
      status: closed ? 'CANCELLED' : 'OPEN',
      startDate: '2020-01-01',
      finalReviewDeadline: '2099-01-01',
    }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === PerformancePeriodAssignment
        ? assignmentRepository
        : entity === PerformancePeriod
          ? periodRepository
          : reviewRepository,
    ),
  } as unknown as EntityManager;
  reviewRepository.manager.transaction.mockImplementation(
    async (run: (value: EntityManager) => Promise<unknown>) => run(manager),
  );
  const access = {
    ensureActorCompanyId: jest.fn().mockReturnValue(1),
    hasCompanyScope: jest.fn().mockReturnValue(true),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const module = await Test.createTestingModule({
    providers: [
      PerformanceReviewService,
      { provide: ConfigService, useValue: { get: jest.fn() } },
      { provide: HrAccessService, useValue: access },
      { provide: PerformanceAuditService, useValue: audit },
      { provide: PerformanceCompetencyService, useValue: {} },
      { provide: PerformanceImprovementPlanService, useValue: {} },
      { provide: PerformanceScorecardService, useValue: {} },
      {
        provide: PerformanceWorkflowService,
        useValue: { initializeForReview: jest.fn() },
      },
      {
        provide: getRepositoryToken(PerformancePeriodAssignment),
        useValue: assignmentRepository,
      },
      {
        provide: getRepositoryToken(PerformanceReview),
        useValue: reviewRepository,
      },
      ...[
        KpiAchievement,
        PerformanceRatingScale,
        PerformanceReviewModeration,
        PerformanceAppeal,
      ].map((entity) => ({
        provide: getRepositoryToken(entity),
        useValue: { find: jest.fn().mockResolvedValue([]) },
      })),
    ],
  }).compile();
  return {
    service: module.get(PerformanceReviewService),
    module,
    assignmentRepository,
    reviewRepository,
  };
}

describe('PerformanceReview lifecycle enforcement', () => {
  it('locks the assignment and advances self review and assignment together', async () => {
    const h = await harness(PerformanceReviewStatusEnum.DRAFT);
    try {
      const saved = await h.service.submitSelfReview(actor, 7, {
        review: { comment: 'Completed my evidence.' },
      });
      expect(h.assignmentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 7, companyId: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(saved.status).toBe(
        PerformanceReviewStatusEnum.MANAGER_REVIEW_PENDING,
      );
      expect(h.assignmentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'MANAGER_REVIEW' }),
      );
      expect(h.reviewRepository.manager.transaction).toHaveBeenCalledTimes(1);
    } finally {
      await h.module.close();
    }
  });
  it.each([
    PerformanceReviewStatusEnum.PUBLISHED,
    PerformanceReviewStatusEnum.HR_REVIEW_PENDING,
  ])(
    'rejects repeated self submission from %s without writing',
    async (status) => {
      const h = await harness(status);
      try {
        await expect(
          h.service.submitSelfReview(actor, 7, {}),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(h.reviewRepository.save).not.toHaveBeenCalled();
        expect(h.assignmentRepository.save).not.toHaveBeenCalled();
      } finally {
        await h.module.close();
      }
    },
  );
  it('requires self submission before manager review', async () => {
    const h = await harness(PerformanceReviewStatusEnum.DRAFT);
    try {
      await expect(
        h.service.submitManagerReview(actor, 7, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.reviewRepository.save).not.toHaveBeenCalled();
    } finally {
      await h.module.close();
    }
  });
  it('rejects review submissions for cancelled cycles', async () => {
    const h = await harness(PerformanceReviewStatusEnum.DRAFT, true);
    try {
      await expect(
        h.service.submitSelfReview(actor, 7, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.reviewRepository.save).not.toHaveBeenCalled();
    } finally {
      await h.module.close();
    }
  });
});
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-workflow.service.ts

```typescript
import { Company } from '../../../companies/entities/company.entity';
import { assertTransition } from '../utils/workflow-validation';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { Department } from '../../departments/entities/department.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { HrAccessService } from '../../shared/hr-access.service';
import {
  CreatePerformanceWorkflowConfigDto,
  PerformanceWorkflowActionDto,
} from '../dto/performance-workflow.dto';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import {
  PerformanceReviewWorkflowStep,
  PerformanceReviewWorkflowStepStatusEnum,
} from '../entities/performance-review-workflow-step.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import {
  PerformanceWorkflowConfig,
  PerformanceWorkflowConfigStep,
} from '../entities/performance-workflow-config.entity';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { PerformancePeriodAssignmentStatusEnum } from '../enums/performance-period-assignment-status.enum';
import { PerformanceReviewStatusEnum } from '../enums/performance-review-status.enum';
import { PerformanceWorkflowStepTypeEnum } from '../enums/performance-workflow-step-type.enum';
import { PerformanceAuditService } from './performance-audit.service';

type WorkflowActionResult = {
  completed: boolean;
  periodAssignmentId: number;
  review: PerformanceReview;
  steps: PerformanceReviewWorkflowStep[];
};

@Injectable()
export class PerformanceWorkflowService {
  constructor(
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    @InjectRepository(PerformanceWorkflowConfig)
    private readonly workflowRepository: Repository<PerformanceWorkflowConfig>,
    @InjectRepository(PerformanceReviewWorkflowStep)
    private readonly reviewStepRepository: Repository<PerformanceReviewWorkflowStep>,
    @InjectRepository(PerformanceReview)
    private readonly reviewRepository: Repository<PerformanceReview>,
    @InjectRepository(PerformancePeriodAssignment)
    private readonly assignmentRepository: Repository<PerformancePeriodAssignment>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreatePerformanceWorkflowConfigDto,
  ): Promise<PerformanceWorkflowConfig> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const steps = this.normalizeSteps(dto.steps);
    this.validateSteps(steps);

    const saved = await this.workflowRepository.manager.transaction(
      async (manager) => {
        // Serialize default switches even when no default configuration exists yet.
        await manager.getRepository(Company).findOne({
          where: { id: companyId },
          lock: { mode: 'pessimistic_write' },
        });
        const repository = manager.getRepository(PerformanceWorkflowConfig);
        if (dto.is_default) {
          await repository.update(
            { companyId, isDefault: true },
            { isDefault: false },
          );
        }

        return await repository.save(
          repository.create({
            companyId,
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            description: dto.description?.trim() ?? null,
            isDefault: dto.is_default ?? false,
            status: 'ACTIVE',
            appliesToDepartmentId: dto.applies_to_department_id ?? null,
            appliesToPositionId: dto.applies_to_position_id ?? null,
            reviewType: dto.review_type?.trim() || null,
            steps,
            createdByCompanyUserId: actor.companyMembershipId ?? null,
          }),
        );
      },
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.WORKFLOW_CONFIG_CREATED,
      actor,
      afterValues: this.configSnapshot(saved),
    });

    return saved;
  }

  async list(actor: AuthenticatedUser): Promise<PerformanceWorkflowConfig[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.workflowRepository.find({
      where: { companyId },
      order: { isDefault: 'DESC', id: 'DESC' },
    });
  }

  async initializeForReview(
    actor: AuthenticatedUser,
    review: PerformanceReview,
    assignment: PerformancePeriodAssignment,
    manager?: EntityManager,
  ): Promise<PerformanceReviewWorkflowStep[]> {
    const repository =
      manager?.getRepository(PerformanceReviewWorkflowStep) ??
      this.reviewStepRepository;
    const existing = await repository.find({
      where: { companyId: review.companyId, performanceReviewId: review.id },
      order: { sequenceNumber: 'ASC' },
    });

    if (existing.length) {
      if (
        existing.some((step) =>
          [
            PerformanceReviewWorkflowStepStatusEnum.RETURNED,
            PerformanceReviewWorkflowStepStatusEnum.REJECTED,
          ].includes(step.status),
        )
      ) {
        const reset = existing.map((step) => ({
          ...step,
          status: PerformanceReviewWorkflowStepStatusEnum.PENDING,
          actedByEmployeeId: null,
          actedByCompanyUserId: null,
          actionComment: null,
          actionAt: null,
          metadata: {
            ...(step.metadata ?? {}),
            reset_at: new Date().toISOString(),
            reset_by_company_user_id: actor.companyMembershipId ?? null,
          },
        }));
        return repository.save(reset);
      }
      return existing;
    }

    const config = await this.resolveActiveConfig(review.companyId, assignment);
    if (!config) {
      return [];
    }

    const assignees = await this.resolveStepAssignees(
      review.companyId,
      assignment,
    );
    const steps = config.steps
      .slice()
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
      .map((step) => {
        const assignee = assignees[step.type] ?? {
          employeeId: null,
          companyUserId: null,
        };
        return repository.create({
          companyId: review.companyId,
          performanceReviewId: review.id,
          periodAssignmentId: assignment.id,
          workflowConfigId: config.id,
          sequenceNumber: step.sequenceNumber,
          code: step.code,
          label: step.label,
          stepType: step.type,
          status: PerformanceReviewWorkflowStepStatusEnum.PENDING,
          assignedEmployeeId: assignee.employeeId,
          assignedCompanyUserId: assignee.companyUserId,
          metadata: {
            required: step.required,
            can_finalize: step.canFinalize,
            configuration: step.configuration ?? null,
          },
        });
      });

    return repository.save(steps);
  }

  async getReviewWorkflow(
    actor: AuthenticatedUser,
    reviewId: number,
  ): Promise<PerformanceReviewWorkflowStep[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    await this.requireReview(companyId, reviewId);
    return this.reviewStepRepository.find({
      where: { companyId, performanceReviewId: reviewId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  async actOnCurrentStep(
    actor: AuthenticatedUser,
    reviewId: number,
    dto: PerformanceWorkflowActionDto,
  ): Promise<WorkflowActionResult> {
    return this.reviewRepository.manager.transaction(async (manager) => {
      const companyId = this.hrAccessService.ensureActorCompanyId(actor);
      let review = await this.requireReview(companyId, reviewId, manager);

      const assignment = await this.requireAssignment(
        companyId,
        review.periodAssignmentId,
        manager,
      );
      review = await this.requireReview(companyId, reviewId, manager);
      assertTransition(
        review.status,
        [
          PerformanceReviewStatusEnum.HR_REVIEW_PENDING,
          PerformanceReviewStatusEnum.MODERATION_PENDING,
          PerformanceReviewStatusEnum.REOPENED,
        ],
        'act on an approval workflow',
      );

      let steps = await manager
        .getRepository(PerformanceReviewWorkflowStep)
        .find({
          where: { companyId, performanceReviewId: review.id },
          order: { sequenceNumber: 'ASC' },
        });

      if (!steps.length) {
        steps = await this.initializeForReview(
          actor,
          review,
          assignment,
          manager,
        );
      }

      if (!steps.length) {
        throw new BadRequestException(
          'No active appraisal workflow configuration is available for this review.',
        );
      }

      const currentStep = steps.find(
        (step) =>
          step.status === PerformanceReviewWorkflowStepStatusEnum.PENDING,
      );

      if (!currentStep) {
        return {
          completed: true,
          periodAssignmentId: assignment.id,
          review,
          steps,
        };
      }

      this.assertCanActionStep(actor, currentStep);

      currentStep.actedByEmployeeId = actor.employeeId ?? null;
      currentStep.actedByCompanyUserId = actor.companyMembershipId ?? null;
      currentStep.actionComment = dto.comment?.trim() || null;
      currentStep.actionAt = new Date();

      if (dto.decision === 'RETURN') {
        currentStep.status = PerformanceReviewWorkflowStepStatusEnum.RETURNED;
        review.status = PerformanceReviewStatusEnum.MANAGER_REVIEW_PENDING;
        assignment.status =
          PerformancePeriodAssignmentStatusEnum.MANAGER_REVIEW;
        await manager
          .getRepository(PerformancePeriodAssignment)
          .save(assignment);
        await manager.getRepository(PerformanceReview).save(review);
      } else if (dto.decision === 'REJECT') {
        currentStep.status = PerformanceReviewWorkflowStepStatusEnum.REJECTED;
        review.status = PerformanceReviewStatusEnum.CANCELLED;
        await manager.getRepository(PerformanceReview).save(review);
      } else {
        currentStep.status = PerformanceReviewWorkflowStepStatusEnum.APPROVED;
      }

      await manager
        .getRepository(PerformanceReviewWorkflowStep)
        .save(currentStep);
      steps = await manager.getRepository(PerformanceReviewWorkflowStep).find({
        where: { companyId, performanceReviewId: review.id },
        order: { sequenceNumber: 'ASC' },
      });

      await this.auditService.log(
        {
          action: PerformanceAuditActionEnum.WORKFLOW_STEP_ACTIONED,
          actor,
          employeeId: review.employeeId,
          performanceReviewId: review.id,
          afterValues: {
            workflow_step_id: currentStep.id,
            code: currentStep.code,
            decision: dto.decision,
            status: currentStep.status,
          },
          reason: currentStep.actionComment,
        },
        manager,
      );

      return {
        completed:
          dto.decision === 'APPROVE' &&
          steps.every(
            (step) =>
              step.status ===
                PerformanceReviewWorkflowStepStatusEnum.APPROVED ||
              step.status === PerformanceReviewWorkflowStepStatusEnum.SKIPPED,
          ),
        periodAssignmentId: assignment.id,
        review,
        steps,
      };
    });
  }

  private async resolveActiveConfig(
    companyId: number,
    assignment: PerformancePeriodAssignment,
  ): Promise<PerformanceWorkflowConfig | null> {
    const employee = await this.employeeRepository.findOne({
      where: { id: assignment.employeeId, company_id: companyId },
    });
    const candidates = await this.workflowRepository.find({
      where: { companyId, status: 'ACTIVE' },
      order: { isDefault: 'DESC', id: 'DESC' },
    });

    return (
      candidates.find(
        (config) =>
          config.appliesToDepartmentId !== null &&
          config.appliesToDepartmentId === employee?.primary_department_id,
      ) ??
      candidates.find(
        (config) =>
          config.appliesToPositionId !== null &&
          config.appliesToPositionId === employee?.primary_position_id,
      ) ??
      candidates.find((config) => config.isDefault) ??
      candidates[0] ??
      null
    );
  }

  private async resolveStepAssignees(
    companyId: number,
    assignment: PerformancePeriodAssignment,
  ): Promise<
    Partial<
      Record<
        PerformanceWorkflowStepTypeEnum,
        { employeeId: number | null; companyUserId: number | null }
      >
    >
  > {
    const employee = await this.employeeRepository.findOne({
      where: { id: assignment.employeeId, company_id: companyId },
    });
    let departmentManager: Employee | null = null;

    if (employee?.primary_department_id) {
      const department = await this.departmentRepository.findOne({
        where: {
          id: employee.primary_department_id,
          company_id: companyId,
        },
      });
      if (department?.manager_employee_id) {
        departmentManager = await this.employeeRepository.findOne({
          where: {
            id: department.manager_employee_id,
            company_id: companyId,
          },
        });
      }
    }

    return {
      [PerformanceWorkflowStepTypeEnum.DIRECT_SUPERVISOR]: {
        employeeId: assignment.managerEmployeeId,
        companyUserId: assignment.managerCompanyUserId,
      },
      [PerformanceWorkflowStepTypeEnum.DEPARTMENT_MANAGER]: {
        employeeId: departmentManager?.id ?? null,
        companyUserId: departmentManager?.company_user_id ?? null,
      },
      [PerformanceWorkflowStepTypeEnum.HR_REVIEW]: {
        employeeId: null,
        companyUserId: null,
      },
      [PerformanceWorkflowStepTypeEnum.FINAL_APPROVAL]: {
        employeeId: null,
        companyUserId: null,
      },
      [PerformanceWorkflowStepTypeEnum.CUSTOM]: {
        employeeId: null,
        companyUserId: null,
      },
    };
  }

  private assertCanActionStep(
    actor: AuthenticatedUser,
    step: PerformanceReviewWorkflowStep,
  ) {
    if (this.hrAccessService.hasCompanyScope(actor)) {
      return;
    }

    if (
      step.assignedEmployeeId &&
      actor.employeeId === step.assignedEmployeeId
    ) {
      return;
    }

    throw new ForbiddenException(
      'Only the assigned approver or HR with company scope can action this workflow step.',
    );
  }

  private normalizeSteps(
    steps: CreatePerformanceWorkflowConfigDto['steps'],
  ): PerformanceWorkflowConfigStep[] {
    return steps
      .map((step) => ({
        code: step.code.trim().toUpperCase(),
        label: step.label.trim(),
        type: step.type,
        sequenceNumber: step.sequence_number,
        required: step.required ?? true,
        canFinalize: step.can_finalize ?? false,
        configuration: step.configuration ?? null,
      }))
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  }

  private validateSteps(steps: PerformanceWorkflowConfigStep[]) {
    const codes = new Set<string>();
    const sequences = new Set<number>();

    for (const step of steps) {
      if (!step.code || !step.label) {
        throw new BadRequestException(
          'Each workflow step needs a code and label.',
        );
      }
      if (codes.has(step.code)) {
        throw new BadRequestException(
          `Duplicate workflow step code: ${step.code}.`,
        );
      }
      if (sequences.has(step.sequenceNumber)) {
        throw new BadRequestException(
          `Duplicate workflow sequence number: ${step.sequenceNumber}.`,
        );
      }
      codes.add(step.code);
      sequences.add(step.sequenceNumber);
    }

    if (!steps.some((step) => step.canFinalize)) {
      steps[steps.length - 1].canFinalize = true;
    }
  }

  private async requireReview(
    companyId: number,
    reviewId: number,
    manager?: EntityManager,
  ): Promise<PerformanceReview> {
    const review = await (
      manager?.getRepository(PerformanceReview) ?? this.reviewRepository
    ).findOne({
      where: { id: reviewId, companyId },
    });
    if (!review) {
      throw new NotFoundException('Performance review not found.');
    }
    return review;
  }

  private async requireAssignment(
    companyId: number,
    assignmentId: number,
    manager?: EntityManager,
  ): Promise<PerformancePeriodAssignment> {
    const assignment = await (
      manager?.getRepository(PerformancePeriodAssignment) ??
      this.assignmentRepository
    ).findOne({
      where: { id: assignmentId, companyId },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!assignment) {
      throw new NotFoundException('Performance period assignment not found.');
    }
    return assignment;
  }

  private configSnapshot(config: PerformanceWorkflowConfig) {
    return {
      id: config.id,
      code: config.code,
      name: config.name,
      is_default: config.isDefault,
      applies_to_department_id: config.appliesToDepartmentId,
      applies_to_position_id: config.appliesToPositionId,
      steps: config.steps,
      version: config.version,
    };
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.service.ts

```typescript
import {
  PerformanceReviewWorkflowStep,
  PerformanceReviewWorkflowStepStatusEnum,
} from '../entities/performance-review-workflow-step.entity';
import { kpiCycleToday } from '../utils/kpi-cycle-date';
import { PerformancePeriod } from '../entities/performance-period.entity';
import { PerformancePeriodStatusEnum } from '../enums/performance-period-status.enum';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { assertTransition } from '../utils/workflow-validation';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { ModeratePerformanceReviewDto } from '../dto/moderate-performance-review.dto';
import { ReopenPerformanceReviewDto } from '../dto/reopen-performance-review.dto';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { SubmitPerformanceAppealDto } from '../dto/submit-performance-appeal.dto';
import { HrAccessService } from '../../shared/hr-access.service';
import { ApprovePerformanceReviewDto } from '../dto/approve-performance-review.dto';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { KpiAchievement } from '../entities/kpi-achievement.entity';
import { PerformanceAppeal } from '../entities/performance-appeal.entity';
import { PerformanceReviewModeration } from '../entities/performance-review-moderation.entity';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import { PerformanceRatingScale } from '../entities/performance-rating-scale.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { PerformanceAppealStatusEnum } from '../enums/performance-appeal-status.enum';
import { KpiAchievementStatusEnum } from '../enums/kpi-achievement-status.enum';
import { PerformancePeriodAssignmentStatusEnum } from '../enums/performance-period-assignment-status.enum';
import { PerformanceReviewStatusEnum } from '../enums/performance-review-status.enum';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformanceCompetencyService } from './performance-competency.service';
import { PerformanceImprovementPlanService } from './performance-improvement-plan.service';
import { PerformanceScorecardService } from './performance-scorecard.service';
import { PerformanceWorkflowService } from './performance-workflow.service';

@Injectable()
export class PerformanceReviewService {
  constructor(
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    private readonly competencyService: PerformanceCompetencyService,
    private readonly improvementPlanService: PerformanceImprovementPlanService,
    private readonly scorecardService: PerformanceScorecardService,
    private readonly workflowService: PerformanceWorkflowService,
    @InjectRepository(KpiAchievement)
    private readonly achievementRepository: Repository<KpiAchievement>,
    @InjectRepository(PerformancePeriodAssignment)
    private readonly assignmentRepository: Repository<PerformancePeriodAssignment>,
    @InjectRepository(PerformanceReview)
    private readonly reviewRepository: Repository<PerformanceReview>,
    @InjectRepository(PerformanceRatingScale)
    private readonly ratingScaleRepository: Repository<PerformanceRatingScale>,
    @InjectRepository(PerformanceReviewModeration)
    private readonly moderationRepository: Repository<PerformanceReviewModeration>,
    @InjectRepository(PerformanceAppeal)
    private readonly appealRepository: Repository<PerformanceAppeal>,
  ) {}

  async submitSelfReview(
    actor: AuthenticatedUser,
    periodAssignmentId: number,
    dto: SubmitSelfReviewDto,
  ): Promise<PerformanceReview> {
    const saved = await this.reviewRepository.manager.transaction(
      async (manager) => {
        if (!actor.employeeId || !actor.companyId) {
          throw new ForbiddenException('Employee company context is required.');
        }

        const assignment = await this.getAssignment(
          actor.companyId,
          periodAssignmentId,
          manager,
        );

        if (assignment.employeeId !== actor.employeeId) {
          throw new ForbiddenException(
            'You can review only your own performance.',
          );
        }

        await this.assertReviewWindow(manager, assignment);
        const review = await this.getOrCreateReview(assignment, manager);
        assertTransition(
          review.status,
          [
            PerformanceReviewStatusEnum.DRAFT,
            PerformanceReviewStatusEnum.OPEN,
            PerformanceReviewStatusEnum.SELF_REVIEW_PENDING,
          ],
          'submit a self review',
        );
        review.employeeSelfReview = dto.review ?? null;
        review.status = PerformanceReviewStatusEnum.MANAGER_REVIEW_PENDING;
        assignment.status =
          PerformancePeriodAssignmentStatusEnum.MANAGER_REVIEW;

        await manager
          .getRepository(PerformancePeriodAssignment)
          .save(assignment);
        return manager.getRepository(PerformanceReview).save(review);
      },
    );
    return saved;
  }

  async submitManagerReview(
    actor: AuthenticatedUser,
    periodAssignmentId: number,
    dto: SubmitManagerReviewDto,
  ): Promise<PerformanceReview> {
    const saved = await this.reviewRepository.manager.transaction(
      async (manager) => {
        const companyId = this.hrAccessService.ensureActorCompanyId(actor);
        const assignment = await this.getAssignment(
          companyId,
          periodAssignmentId,
          manager,
        );

        const managerHasAccess =
          actor.employeeId === assignment.managerEmployeeId ||
          this.hrAccessService.hasCompanyScope(actor);

        if (!managerHasAccess) {
          throw new ForbiddenException(
            'Only the assigned manager or HR with company scope can submit this review.',
          );
        }

        await this.assertReviewWindow(manager, assignment);
        const review = await this.getOrCreateReview(assignment, manager);
        assertTransition(
          review.status,
          [PerformanceReviewStatusEnum.MANAGER_REVIEW_PENDING],
          'submit a manager review',
        );

        if (
          dto.review &&
          typeof dto.review.competency_template_id === 'number'
        ) {
          await this.competencyService.initializeRatingsForReview(
            companyId,
            review.id,
            dto.review.competency_template_id,
          );
        }

        if (dto.competency_ratings?.length) {
          const scored = await this.competencyService.scoreManagerRatings(
            companyId,
            review.id,
            dto.competency_ratings,
          );
          review.competencyScore = scored.competencyScore.toFixed(4);
        }

        review.managerReview = dto.review ?? null;
        review.areasOfStrength = dto.areas_of_strength ?? null;
        review.areasForImprovement = dto.areas_for_improvement ?? null;
        review.trainingNeeds = dto.training_needs ?? null;
        review.recommendations = dto.recommendations ?? null;
        review.status = PerformanceReviewStatusEnum.HR_REVIEW_PENDING;
        assignment.status = PerformancePeriodAssignmentStatusEnum.HR_REVIEW;

        const saved = await manager
          .getRepository(PerformanceReview)
          .save(review);
        await manager
          .getRepository(PerformancePeriodAssignment)
          .save(assignment);

        await this.auditService.log(
          {
            action: PerformanceAuditActionEnum.MANAGER_REVIEW_SUBMITTED,
            actor,
            employeeId: assignment.employeeId,
            performanceReviewId: saved.id,
            afterValues: {
              performance_review_id: saved.id,
              competency_score: saved.competencyScore,
              status: saved.status,
            },
          },
          manager,
        );

        await this.workflowService.initializeForReview(
          actor,
          saved,
          assignment,
          manager,
        );
        return saved;
      },
    );

    return saved;
  }

  async approve(
    actor: AuthenticatedUser,
    periodAssignmentId: number,
    dto: ApprovePerformanceReviewDto,
  ): Promise<PerformanceReview> {
    const saved = await this.reviewRepository.manager.transaction(
      async (manager) => {
        const companyId = this.hrAccessService.ensureActorCompanyId(actor);
        const assignment = await this.getAssignment(
          companyId,
          periodAssignmentId,
          manager,
        );
        const achievements = await this.achievementRepository.find({
          where: { companyId, periodAssignmentId },
          order: { id: 'ASC' },
        });

        if (
          achievements.some(
            (achievement) =>
              achievement.status !==
                KpiAchievementStatusEnum.MANAGER_VALIDATED &&
              achievement.status !== KpiAchievementStatusEnum.HR_APPROVED &&
              achievement.status !== KpiAchievementStatusEnum.PUBLISHED,
          )
        ) {
          throw new BadRequestException(
            'All KPI achievements must be manager-validated before HR approval.',
          );
        }

        const review = await this.getOrCreateReview(assignment, manager);
        assertTransition(
          review.status,
          [
            PerformanceReviewStatusEnum.HR_REVIEW_PENDING,
            PerformanceReviewStatusEnum.MODERATION_PENDING,
            PerformanceReviewStatusEnum.REOPENED,
            PerformanceReviewStatusEnum.APPROVED,
          ],
          'approve or publish',
        );
        const workflowSteps = await manager
          .getRepository(PerformanceReviewWorkflowStep)
          .find({ where: { companyId, performanceReviewId: review.id } });
        if (
          workflowSteps.some(
            (step) =>
              ![
                PerformanceReviewWorkflowStepStatusEnum.APPROVED,
                PerformanceReviewWorkflowStepStatusEnum.SKIPPED,
              ].includes(step.status),
          )
        ) {
          throw new ConflictException(
            'Complete all configured appraisal approval steps before approving or publishing this review.',
          );
        }
        const adjustmentScore =
          dto.adjustment_score ?? Number(review.adjustmentScore ?? 0);
        const scorecardCalculation =
          await this.scorecardService.calculateReviewScore({
            companyId,
            assignment,
            review,
            achievements,
            adjustmentScore,
          });

        review.kpiScore = scorecardCalculation.kpiScore;
        review.adjustmentScore = scorecardCalculation.adjustmentScore;
        review.competencyScore = scorecardCalculation.competencyScore;
        review.finalScore = scorecardCalculation.finalScore;
        review.hrReview = dto.hr_review ?? null;
        review.status = dto.publish
          ? PerformanceReviewStatusEnum.PUBLISHED
          : PerformanceReviewStatusEnum.APPROVED;
        review.calculationSnapshot = {
          ...scorecardCalculation.snapshot,
          achievement_ids: achievements.map((item) => item.id),
          achievement_scores: achievements.map((item) => ({
            id: item.id,
            raw_score: item.rawScore,
            capped_score: item.cappedScore,
            weighted_score: item.weightedScore,
          })),
          kpi_score: review.kpiScore,
          competency_score: review.competencyScore,
          adjustment_score: review.adjustmentScore,
          final_score: review.finalScore,
        };
        review.calculationHash = createHash('sha256')
          .update(JSON.stringify(review.calculationSnapshot))
          .digest('hex');

        const ratingScale = await this.ratingScaleRepository.findOne({
          where: { companyId, isDefault: true, status: 'ACTIVE' },
          relations: { bands: true },
        });

        if (ratingScale) {
          const finalScoreNumber = Number(review.finalScore);
          const matchingBand = ratingScale.bands.find(
            (band) =>
              finalScoreNumber >= Number(band.minimumScore) &&
              finalScoreNumber <= Number(band.maximumScore),
          );

          review.ratingScaleId = ratingScale.id;
          review.ratingBandId = matchingBand?.id ?? null;
          review.ratingCode = matchingBand?.code ?? null;
        }

        if (dto.publish) {
          review.publishedAt = new Date();
          review.appealDeadlineAt = this.resolveAppealDeadline();
          assignment.status = PerformancePeriodAssignmentStatusEnum.PUBLISHED;
          assignment.publishedAt = new Date();

          for (const achievement of achievements) {
            achievement.status = KpiAchievementStatusEnum.PUBLISHED;
            achievement.publishedAt = new Date();
          }

          await manager.getRepository(KpiAchievement).save(achievements);
        } else {
          assignment.status = PerformancePeriodAssignmentStatusEnum.APPROVED;
          assignment.approvedAt = new Date();
        }

        await manager
          .getRepository(PerformancePeriodAssignment)
          .save(assignment);
        const saved = await manager
          .getRepository(PerformanceReview)
          .save(review);

        await this.auditService.log(
          {
            action: dto.publish
              ? PerformanceAuditActionEnum.REVIEW_PUBLISHED
              : PerformanceAuditActionEnum.REVIEW_APPROVED,
            actor,
            employeeId: assignment.employeeId,
            performanceReviewId: saved.id,
            afterValues: {
              performance_review_id: saved.id,
              final_score: saved.finalScore,
              rating_code: saved.ratingCode,
              status: saved.status,
            },
          },
          manager,
        );

        return saved;
      },
    );
    if (dto.publish && saved.ratingBandId) {
      const scale = await this.ratingScaleRepository.findOne({
        where: {
          companyId: saved.companyId,
          isDefault: true,
          status: 'ACTIVE',
        },
        relations: { bands: true },
      });
      if (
        scale?.bands.some(
          (band) =>
            band.id === saved.ratingBandId && band.requiresImprovementPlan,
        )
      ) {
        await this.ensureImprovementPlanForReview(saved.id, actor);
      }
    }
    return saved;
  }

  async moderate(
    actor: AuthenticatedUser,
    reviewId: number,
    dto: ModeratePerformanceReviewDto,
  ): Promise<PerformanceReview> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const review = await this.requireReview(companyId, reviewId);
    assertTransition(
      review.status,
      [
        PerformanceReviewStatusEnum.HR_REVIEW_PENDING,
        PerformanceReviewStatusEnum.MODERATION_PENDING,
        PerformanceReviewStatusEnum.APPROVED,
        PerformanceReviewStatusEnum.REOPENED,
      ],
      'moderate',
    );
    if (!dto.reason?.trim())
      throw new BadRequestException('A moderation reason is required.');
    const beforeScore = review.finalScore;

    if (dto.final_score !== undefined) {
      const period = await this.reviewRepository.manager
        .getRepository(PerformancePeriod)
        .findOne({ where: { id: review.performancePeriodId, companyId } });
      if (!period) throw new NotFoundException('Performance period not found.');
      const cap = Number(period.scoreCap);
      if (
        !Number.isFinite(dto.final_score) ||
        dto.final_score < 0 ||
        !Number.isFinite(cap) ||
        dto.final_score > cap
      )
        throw new BadRequestException(
          `Moderated score must be between 0 and the cycle score cap of ${cap}.`,
        );
      review.finalScore = dto.final_score.toFixed(4);
      await this.applyRatingBand(companyId, review, dto.final_score);
    }

    review.moderationSnapshot = {
      ...(review.moderationSnapshot ?? {}),
      latest: {
        reason: dto.reason.trim(),
        snapshot: dto.snapshot ?? null,
        moderated_at: new Date().toISOString(),
      },
    };

    const saved = await this.reviewRepository.save(review);
    await this.moderationRepository.save(
      this.moderationRepository.create({
        companyId,
        performanceReviewId: review.id,
        moderatedByCompanyUserId: actor.companyMembershipId ?? null,
        previousFinalScore: beforeScore,
        newFinalScore: saved.finalScore,
        reason: dto.reason.trim(),
        snapshot: dto.snapshot ?? {},
      }),
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.MODERATION_COMPLETED,
      actor,
      employeeId: saved.employeeId,
      performanceReviewId: saved.id,
      beforeValues: { final_score: beforeScore },
      afterValues: {
        final_score: saved.finalScore,
        rating_code: saved.ratingCode,
      },
      reason: dto.reason.trim(),
    });

    return saved;
  }

  async reopen(
    actor: AuthenticatedUser,
    reviewId: number,
    dto: ReopenPerformanceReviewDto,
  ): Promise<PerformanceReview> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    const review = await this.requireReview(companyId, reviewId);

    assertTransition(
      review.status,
      [
        PerformanceReviewStatusEnum.APPROVED,
        PerformanceReviewStatusEnum.PUBLISHED,
        PerformanceReviewStatusEnum.LOCKED,
        PerformanceReviewStatusEnum.APPEALED,
      ],
      'reopen',
    );
    if (!dto.reason?.trim())
      throw new BadRequestException('A reopen reason is required.');

    if (!this.configService.get<boolean>('PERFORMANCE_ALLOW_REOPEN', false)) {
      throw new ConflictException('Performance review reopen is disabled.');
    }

    const assignment = await this.getAssignment(
      companyId,
      review.periodAssignmentId,
    );

    review.calculationSnapshot = {
      ...(review.calculationSnapshot ?? {}),
      previous_revision: {
        revision_number: review.revisionNumber,
        final_score: review.finalScore,
        rating_code: review.ratingCode,
        published_at: review.publishedAt?.toISOString() ?? null,
        reopen_reason: dto.reason.trim(),
      },
    };
    review.revisionNumber += 1;
    review.status = PerformanceReviewStatusEnum.REOPENED;
    review.publishedAt = null;
    review.lockedAt = null;
    review.appealDeadlineAt = null;
    assignment.status = PerformancePeriodAssignmentStatusEnum.HR_REVIEW;
    assignment.publishedAt = null;

    await this.assignmentRepository.save(assignment);
    const saved = await this.reviewRepository.save(review);

    await this.auditService.log({
      action: PerformanceAuditActionEnum.REVIEW_REOPENED,
      actor,
      employeeId: saved.employeeId,
      performanceReviewId: saved.id,
      afterValues: {
        revision_number: saved.revisionNumber,
        status: saved.status,
      },
      reason: dto.reason.trim(),
    });

    return saved;
  }

  async submitAppeal(
    actor: AuthenticatedUser,
    reviewId: number,
    dto: SubmitPerformanceAppealDto,
  ): Promise<PerformanceAppeal> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    if (!actor.employeeId) {
      throw new ForbiddenException('Employee context is required.');
    }

    const review = await this.requireReview(companyId, reviewId);
    if (review.employeeId !== actor.employeeId) {
      throw new ForbiddenException(
        'You can appeal only your own performance review.',
      );
    }

    if (review.status !== PerformanceReviewStatusEnum.PUBLISHED) {
      throw new BadRequestException(
        'Only published performance reviews can be appealed.',
      );
    }

    if (
      review.appealDeadlineAt &&
      review.appealDeadlineAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'The appeal window for this performance review has expired.',
      );
    }

    const appeal = await this.appealRepository.save(
      this.appealRepository.create({
        companyId,
        performanceReviewId: review.id,
        employeeId: actor.employeeId,
        status: PerformanceAppealStatusEnum.SUBMITTED,
        reason: dto.reason.trim(),
        requestedChanges: dto.requested_changes ?? null,
      }),
    );

    review.status = PerformanceReviewStatusEnum.APPEALED;
    await this.reviewRepository.save(review);

    await this.auditService.log({
      action: PerformanceAuditActionEnum.REVIEW_APPEALED,
      actor,
      employeeId: review.employeeId,
      performanceReviewId: review.id,
      afterValues: { performance_appeal_id: appeal.id, status: appeal.status },
      reason: dto.reason.trim(),
    });

    return appeal;
  }

  async listForEmployee(
    actor: AuthenticatedUser,
    employeeId: number,
  ): Promise<PerformanceReview[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.reviewRepository.find({
      where: { companyId, employeeId },
      order: { id: 'DESC' },
    });
  }

  async listAppeals(actor: AuthenticatedUser): Promise<PerformanceAppeal[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.appealRepository.find({
      where: { companyId },
      order: { id: 'DESC' },
    });
  }

  private async assertReviewWindow(
    manager: EntityManager,
    assignment: PerformancePeriodAssignment,
  ): Promise<void> {
    const period = await manager.getRepository(PerformancePeriod).findOne({
      where: {
        id: assignment.performancePeriodId,
        companyId: assignment.companyId,
      },
    });
    if (!period) throw new NotFoundException('Performance period not found.');
    if (
      [
        PerformancePeriodStatusEnum.DRAFT,
        PerformancePeriodStatusEnum.CANCELLED,
      ].includes(period.status)
    ) {
      throw new ConflictException(
        'Activate this performance period before submitting reviews. Cancelled periods cannot accept reviews.',
      );
    }
    if (period.kpiPhase === 'REOPENED') return;
    const day = kpiCycleToday();
    if (
      day < period.startDate ||
      (period.finalReviewDeadline && day > period.finalReviewDeadline)
    ) {
      throw new ConflictException(
        'This review is outside the configured cycle submission dates. Ask HR to correct or reopen the cycle before submitting.',
      );
    }
  }

  private async getAssignment(
    companyId: number,
    id: number,
    manager?: EntityManager,
  ): Promise<PerformancePeriodAssignment> {
    const assignment = await (
      manager?.getRepository(PerformancePeriodAssignment) ??
      this.assignmentRepository
    ).findOne({
      where: { id, companyId },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!assignment) {
      throw new NotFoundException('Performance period assignment not found.');
    }

    return assignment;
  }

  private async getOrCreateReview(
    assignment: PerformancePeriodAssignment,
    manager?: EntityManager,
  ): Promise<PerformanceReview> {
    const repository =
      manager?.getRepository(PerformanceReview) ?? this.reviewRepository;
    const existing = await repository.findOne({
      where: {
        companyId: assignment.companyId,
        performancePeriodId: assignment.performancePeriodId,
        employeeId: assignment.employeeId,
      },
    });

    if (existing) {
      return existing;
    }

    return repository.save(
      repository.create({
        companyId: assignment.companyId,
        performancePeriodId: assignment.performancePeriodId,
        periodAssignmentId: assignment.id,
        employeeId: assignment.employeeId,
        managerEmployeeId: assignment.managerEmployeeId,
        managerCompanyUserId: assignment.managerCompanyUserId,
        status: PerformanceReviewStatusEnum.DRAFT,
        adjustmentScore: '0.0000',
      }),
    );
  }

  private async requireReview(
    companyId: number,
    reviewId: number,
  ): Promise<PerformanceReview> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId, companyId },
    });

    if (!review) {
      throw new NotFoundException('Performance review not found.');
    }

    return review;
  }

  private async applyRatingBand(
    companyId: number,
    review: PerformanceReview,
    finalScore: number,
  ) {
    const ratingScale = await this.ratingScaleRepository.findOne({
      where: { companyId, isDefault: true, status: 'ACTIVE' },
      relations: { bands: true },
    });

    if (!ratingScale) {
      return;
    }

    const matchingBand = ratingScale.bands.find(
      (band) =>
        finalScore >= Number(band.minimumScore) &&
        finalScore <= Number(band.maximumScore),
    );

    review.ratingScaleId = ratingScale.id;
    review.ratingBandId = matchingBand?.id ?? null;
    review.ratingCode = matchingBand?.code ?? null;
  }

  private resolveAppealDeadline(): Date {
    const days = this.configService.get<number>(
      'PERFORMANCE_DEFAULT_APPEAL_DAYS',
      5,
    );
    const deadline = new Date();
    deadline.setUTCDate(deadline.getUTCDate() + days);
    return deadline;
  }

  private async ensureImprovementPlanForReview(
    reviewId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.improvementPlanService.create(actor, reviewId, {
        summary: 'Auto-created from performance rating requiring improvement.',
        objectives: [
          'Address identified performance gaps',
          'Complete agreed development actions',
        ],
        milestones: [
          {
            title: 'Initial coaching review',
            due_date: new Date().toISOString().slice(0, 10),
          },
          {
            title: 'Follow-up progress review',
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          },
        ],
      });
    } catch {
      // Best-effort creation to avoid blocking publication when a PIP already exists
      // or requires additional manual detail later.
    }
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-scorecard.service.ts

```typescript
import { Company } from '../../../companies/entities/company.entity';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { AttendanceDailySummary } from '../../attendance/processing/entities/attendance-daily-summary.entity';
import { AttendanceDailyStatusEnum } from '../../attendance/processing/enums/attendance-daily-status.enum';
import {
  DailyActivityEntry,
  DailyActivityReport,
} from '../../work-activities/entities/daily-activity.entities';
import {
  DailyActivityEntryReviewStatusEnum,
  DailyActivityReportStatusEnum,
  DailyActivityStatusEnum,
} from '../../work-activities/enums/work-activity.enums';
import { HrAccessService } from '../../shared/hr-access.service';
import { CreatePerformanceScorecardConfigDto } from '../dto/performance-scorecard-config.dto';
import { KpiAchievement } from '../entities/kpi-achievement.entity';
import { PerformanceFeedback360Request } from '../entities/performance-feedback-360-request.entity';
import {
  PerformanceScorecardComponent,
  PerformanceScorecardConfig,
} from '../entities/performance-scorecard-config.entity';
import { PerformancePeriod } from '../entities/performance-period.entity';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { PerformanceFeedback360StatusEnum } from '../enums/performance-feedback-360-status.enum';
import { PerformanceScorecardComponentTypeEnum } from '../enums/performance-scorecard-component-type.enum';
import { PerformanceAuditService } from './performance-audit.service';

type CalculatedScorecard = {
  kpiScore: string;
  competencyScore: string | null;
  adjustmentScore: string;
  finalScore: string;
  snapshot: Record<string, unknown>;
};

type ComponentScore = {
  code: string;
  label: string;
  type: PerformanceScorecardComponentTypeEnum;
  weight: string;
  rawScore: string | null;
  weightedScore: string;
  required: boolean;
  source: Record<string, unknown>;
};

const LEGACY_COMPONENTS: PerformanceScorecardComponent[] = [
  {
    code: 'KPI',
    label: 'KPI performance',
    type: PerformanceScorecardComponentTypeEnum.KPI,
    weight: 100,
    enabled: true,
    required: true,
  },
  {
    code: 'ADJUSTMENT',
    label: 'HR adjustment',
    type: PerformanceScorecardComponentTypeEnum.ADJUSTMENT,
    weight: 100,
    enabled: true,
    required: false,
  },
  {
    code: 'COMPETENCY',
    label: 'Competency score',
    type: PerformanceScorecardComponentTypeEnum.COMPETENCY,
    weight: 100,
    enabled: true,
    required: false,
  },
];

@Injectable()
export class PerformanceScorecardService {
  constructor(
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    @InjectRepository(PerformanceScorecardConfig)
    private readonly scorecardRepository: Repository<PerformanceScorecardConfig>,
    @InjectRepository(PerformancePeriod)
    private readonly periodRepository: Repository<PerformancePeriod>,
    @InjectRepository(DailyActivityEntry)
    private readonly activityEntryRepository: Repository<DailyActivityEntry>,
    @InjectRepository(AttendanceDailySummary)
    private readonly attendanceRepository: Repository<AttendanceDailySummary>,
    @InjectRepository(PerformanceFeedback360Request)
    private readonly feedback360Repository: Repository<PerformanceFeedback360Request>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreatePerformanceScorecardConfigDto,
  ): Promise<PerformanceScorecardConfig> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    this.validateDateRange(dto.effective_from, dto.effective_to);
    const components = this.normalizeComponents(dto.components);
    this.validateWeightTotal(components);

    const saved = await this.scorecardRepository.manager.transaction(
      async (manager) => {
        // Serialize default switches even when no default configuration exists yet.
        await manager.getRepository(Company).findOne({
          where: { id: companyId },
          lock: { mode: 'pessimistic_write' },
        });
        const repository = manager.getRepository(PerformanceScorecardConfig);
        if (dto.is_default) {
          await repository.update(
            { companyId, isDefault: true },
            { isDefault: false },
          );
        }

        return await repository.save(
          repository.create({
            companyId,
            code: dto.code.trim().toUpperCase(),
            name: dto.name.trim(),
            description: dto.description?.trim() ?? null,
            isDefault: dto.is_default ?? false,
            status: 'ACTIVE',
            effectiveFrom: dto.effective_from ?? null,
            effectiveTo: dto.effective_to ?? null,
            components,
            createdByCompanyUserId: actor.companyMembershipId ?? null,
          }),
        );
      },
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.SCORECARD_CONFIG_CREATED,
      actor,
      afterValues: this.configSnapshot(saved),
    });

    return saved;
  }

  async list(actor: AuthenticatedUser): Promise<PerformanceScorecardConfig[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);
    return this.scorecardRepository.find({
      where: { companyId },
      order: { isDefault: 'DESC', id: 'DESC' },
    });
  }

  async calculateReviewScore(input: {
    companyId: number;
    assignment: PerformancePeriodAssignment;
    review: PerformanceReview;
    achievements: KpiAchievement[];
    adjustmentScore: number;
  }): Promise<CalculatedScorecard> {
    const period = await this.periodRepository.findOne({
      where: {
        id: input.assignment.performancePeriodId,
        companyId: input.companyId,
      },
    });
    if (!period) {
      throw new BadRequestException('Performance period not found.');
    }

    const scorecard = await this.resolveActiveScorecard(
      input.companyId,
      period,
    );
    const components = scorecard?.components ?? LEGACY_COMPONENTS;
    const componentScores: ComponentScore[] = [];

    for (const component of components.filter((item) => item.enabled)) {
      const raw = await this.resolveComponentRawScore(component, {
        ...input,
        period,
      });
      const bounded = this.applyBounds(raw, component);
      const weighted =
        bounded === null
          ? new Decimal(0)
          : bounded.mul(new Decimal(component.weight).div(100));
      componentScores.push({
        code: component.code,
        label: component.label,
        type: component.type,
        weight: new Decimal(component.weight).toDecimalPlaces(2).toFixed(2),
        rawScore: bounded?.toDecimalPlaces(4).toFixed(4) ?? null,
        weightedScore: weighted.toDecimalPlaces(4).toFixed(4),
        required: component.required ?? false,
        source: this.componentSource(component, raw),
      });
    }

    const kpiRaw = componentScores.find(
      (item) => item.type === PerformanceScorecardComponentTypeEnum.KPI,
    )?.rawScore;
    const competencyRaw = componentScores.find(
      (item) => item.type === PerformanceScorecardComponentTypeEnum.COMPETENCY,
    )?.rawScore;
    const adjustmentWeighted = componentScores
      .filter(
        (item) =>
          item.type === PerformanceScorecardComponentTypeEnum.ADJUSTMENT,
      )
      .reduce((sum, item) => sum.plus(item.weightedScore), new Decimal(0));
    const finalScore = componentScores.reduce(
      (sum, item) => sum.plus(item.weightedScore),
      new Decimal(0),
    );

    return {
      kpiScore:
        kpiRaw ??
        input.achievements
          .reduce(
            (sum, achievement) => sum.plus(achievement.weightedScore ?? 0),
            new Decimal(0),
          )
          .toDecimalPlaces(4)
          .toFixed(4),
      competencyScore: competencyRaw ?? input.review.competencyScore,
      adjustmentScore: adjustmentWeighted.toDecimalPlaces(4).toFixed(4),
      finalScore: finalScore.toDecimalPlaces(4).toFixed(4),
      snapshot: {
        scorecard_config_id: scorecard?.id ?? null,
        scorecard_code: scorecard?.code ?? 'LEGACY_FIXED_KPI',
        scorecard_name: scorecard?.name ?? 'Legacy fixed KPI calculation',
        performance_period_id: period.id,
        period_dates: {
          start_date: period.startDate,
          end_date: period.endDate,
        },
        components: componentScores,
      },
    };
  }

  private async resolveActiveScorecard(
    companyId: number,
    period: PerformancePeriod,
  ): Promise<PerformanceScorecardConfig | null> {
    const candidates = await this.scorecardRepository.find({
      where: { companyId, status: 'ACTIVE' },
      order: { isDefault: 'DESC', id: 'DESC' },
    });
    return (
      candidates.find(
        (config) =>
          (!config.effectiveFrom || config.effectiveFrom <= period.startDate) &&
          (!config.effectiveTo || config.effectiveTo >= period.endDate),
      ) ?? null
    );
  }

  private async resolveComponentRawScore(
    component: PerformanceScorecardComponent,
    input: {
      companyId: number;
      assignment: PerformancePeriodAssignment;
      review: PerformanceReview;
      achievements: KpiAchievement[];
      adjustmentScore: number;
      period: PerformancePeriod;
    },
  ): Promise<Decimal | null> {
    switch (component.type) {
      case PerformanceScorecardComponentTypeEnum.KPI:
        return input.achievements.reduce(
          (sum, achievement) => sum.plus(achievement.weightedScore ?? 0),
          new Decimal(0),
        );
      case PerformanceScorecardComponentTypeEnum.COMPETENCY:
        return input.review.competencyScore === null
          ? null
          : new Decimal(input.review.competencyScore);
      case PerformanceScorecardComponentTypeEnum.ACTIVITIES:
        return this.calculateActivityScore(input);
      case PerformanceScorecardComponentTypeEnum.ATTENDANCE:
        return this.calculateAttendanceScore(input);
      case PerformanceScorecardComponentTypeEnum.MANAGER_ASSESSMENT:
        return this.extractNumericScore(input.review.managerReview, [
          'manager_assessment_score',
          'manager_score',
          'overall_score',
        ]);
      case PerformanceScorecardComponentTypeEnum.SELF_ASSESSMENT:
        return this.extractNumericScore(input.review.employeeSelfReview, [
          'self_assessment_score',
          'self_score',
          'overall_score',
        ]);
      case PerformanceScorecardComponentTypeEnum.PEER_FEEDBACK: {
        const feedbackScore = await this.calculatePeerFeedbackScore(
          input.companyId,
          input.review.id,
        );
        return (
          feedbackScore ??
          this.extractNumericScore(input.review.hrReview, [
            component.code,
            `${component.code.toLowerCase()}_score`,
            'manual_score',
          ])
        );
      }
      case PerformanceScorecardComponentTypeEnum.MANUAL:
        return this.extractNumericScore(input.review.hrReview, [
          component.code,
          `${component.code.toLowerCase()}_score`,
          'manual_score',
        ]);
      case PerformanceScorecardComponentTypeEnum.ADJUSTMENT:
        return new Decimal(input.adjustmentScore);
      default:
        return null;
    }
  }

  private async calculateActivityScore(input: {
    companyId: number;
    assignment: PerformancePeriodAssignment;
    period: PerformancePeriod;
  }): Promise<Decimal | null> {
    const total = await this.activityEntryRepository
      .createQueryBuilder('entry')
      .innerJoin(
        DailyActivityReport,
        'report',
        'report.id = entry.dailyActivityReportId',
      )
      .where('entry.companyId = :companyId', { companyId: input.companyId })
      .andWhere('report.employeeId = :employeeId', {
        employeeId: input.assignment.employeeId,
      })
      .andWhere('report.activityDate >= :startDate', {
        startDate: input.period.startDate,
      })
      .andWhere('report.activityDate <= :endDate', {
        endDate: input.period.endDate,
      })
      .andWhere('entry.status != :cancelled', {
        cancelled: DailyActivityStatusEnum.CANCELLED,
      })
      .getCount();

    if (total === 0) return null;

    const completedApproved = await this.activityEntryRepository
      .createQueryBuilder('entry')
      .innerJoin(
        DailyActivityReport,
        'report',
        'report.id = entry.dailyActivityReportId',
      )
      .where('entry.companyId = :companyId', { companyId: input.companyId })
      .andWhere('report.employeeId = :employeeId', {
        employeeId: input.assignment.employeeId,
      })
      .andWhere('report.activityDate >= :startDate', {
        startDate: input.period.startDate,
      })
      .andWhere('report.activityDate <= :endDate', {
        endDate: input.period.endDate,
      })
      .andWhere('report.status = :reportStatus', {
        reportStatus: DailyActivityReportStatusEnum.APPROVED,
      })
      .andWhere('entry.status = :entryStatus', {
        entryStatus: DailyActivityStatusEnum.COMPLETED,
      })
      .andWhere(
        '(entry.reviewStatus = :approved OR entry.managerValidated = true)',
        { approved: DailyActivityEntryReviewStatusEnum.APPROVED },
      )
      .getCount();

    return new Decimal(completedApproved).div(total).mul(100);
  }

  private async calculateAttendanceScore(input: {
    companyId: number;
    assignment: PerformancePeriodAssignment;
    period: PerformancePeriod;
  }): Promise<Decimal | null> {
    const summaries = await this.attendanceRepository.find({
      where: {
        companyId: input.companyId,
        employeeId: input.assignment.employeeId,
      },
    });
    const periodSummaries = summaries.filter(
      (summary) =>
        summary.attendanceDate >= input.period.startDate &&
        summary.attendanceDate <= input.period.endDate,
    );
    const excluded = new Set<string>([
      AttendanceDailyStatusEnum.OFF_DAY,
      AttendanceDailyStatusEnum.HOLIDAY,
      AttendanceDailyStatusEnum.NO_SHIFT_SCHEDULE,
    ]);
    const eligible = periodSummaries.filter(
      (summary) => !excluded.has(summary.attendanceStatus),
    );
    if (!eligible.length) return null;

    const negativeStatuses = new Set<string>([
      AttendanceDailyStatusEnum.ABSENT,
      AttendanceDailyStatusEnum.UNPAID_LEAVE,
    ]);
    const presentDays = eligible.filter(
      (summary) => !negativeStatuses.has(summary.attendanceStatus),
    ).length;
    const attendanceRate = new Decimal(presentDays)
      .div(eligible.length)
      .mul(100);
    const lateEarlyMinutes = eligible.reduce(
      (sum, summary) =>
        sum + summary.lateMinutes + summary.earlyDepartureMinutes,
      0,
    );
    const punctualityPenalty = Decimal.min(
      20,
      new Decimal(lateEarlyMinutes).mul(0.25),
    );
    return Decimal.max(0, attendanceRate.minus(punctualityPenalty));
  }

  private async calculatePeerFeedbackScore(
    companyId: number,
    performanceReviewId: number,
  ): Promise<Decimal | null> {
    const submitted = await this.feedback360Repository.find({
      where: {
        companyId,
        performanceReviewId,
        status: PerformanceFeedback360StatusEnum.SUBMITTED,
      },
    });
    if (!submitted.length) return null;

    const total = submitted.reduce(
      (sum, item) => sum.plus(item.overallScore ?? 0),
      new Decimal(0),
    );
    return total.div(submitted.length);
  }

  private extractNumericScore(
    source: Record<string, unknown> | null,
    keys: string[],
  ): Decimal | null {
    if (!source) return null;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' || typeof value === 'string') {
        try {
          const decimal = new Decimal(value);
          if (decimal.isFinite()) return decimal;
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private applyBounds(
    score: Decimal | null,
    component: PerformanceScorecardComponent,
  ): Decimal | null {
    if (score === null) return component.required ? new Decimal(0) : null;
    let bounded = score;
    if (component.floor !== null && component.floor !== undefined) {
      bounded = Decimal.max(bounded, new Decimal(component.floor));
    }
    if (component.cap !== null && component.cap !== undefined) {
      bounded = Decimal.min(bounded, new Decimal(component.cap));
    }
    return bounded;
  }

  private normalizeComponents(
    components: CreatePerformanceScorecardConfigDto['components'],
  ): PerformanceScorecardComponent[] {
    return components.map((component) => ({
      code: component.code.trim().toUpperCase(),
      label: component.label.trim(),
      type: component.type,
      weight: component.weight,
      enabled: component.enabled ?? true,
      required: component.required ?? false,
      cap: component.cap ?? 100,
      floor: component.floor ?? 0,
      configuration: component.configuration ?? null,
    }));
  }

  private validateWeightTotal(components: PerformanceScorecardComponent[]) {
    const total = components
      .filter((component) => component.enabled)
      .reduce((sum, component) => sum.plus(component.weight), new Decimal(0));
    if (!total.eq(100)) {
      throw new BadRequestException(
        `Enabled scorecard component weights must total 100. Current total: ${total.toString()}.`,
      );
    }
  }

  private validateDateRange(from?: string, to?: string) {
    if (from && to && to < from) {
      throw new BadRequestException(
        'effective_to must not be earlier than effective_from.',
      );
    }
  }

  private componentSource(
    component: PerformanceScorecardComponent,
    rawScore: Decimal | null,
  ) {
    return {
      component_configuration: component.configuration ?? null,
      raw_score_available: rawScore !== null,
    };
  }

  private configSnapshot(config: PerformanceScorecardConfig) {
    return {
      id: config.id,
      code: config.code,
      name: config.name,
      is_default: config.isDefault,
      effective_from: config.effectiveFrom,
      effective_to: config.effectiveTo,
      components: config.components,
      version: config.version,
    };
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-competency.service.ts

```typescript
import {
  assertWeightTotal,
  assertUniqueValues,
} from '../utils/workflow-validation';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { CreateCompetencyTemplateDto } from '../dto/create-competency-template.dto';
import { CompetencyTemplate } from '../entities/competency-template.entity';
import { PerformanceCompetencyRating } from '../entities/performance-competency-rating.entity';

@Injectable()
export class PerformanceCompetencyService {
  constructor(
    @InjectRepository(CompetencyTemplate)
    private readonly competencyTemplateRepository: Repository<CompetencyTemplate>,
    @InjectRepository(PerformanceCompetencyRating)
    private readonly competencyRatingRepository: Repository<PerformanceCompetencyRating>,
  ) {}

  async createTemplate(
    actor: AuthenticatedUser,
    dto: CreateCompetencyTemplateDto,
  ): Promise<CompetencyTemplate> {
    if (!actor.companyId) {
      throw new BadRequestException('Active company context is required.');
    }

    assertWeightTotal(
      dto.items.map((item) => item.weight),
      'Competency template',
    );
    assertUniqueValues(
      dto.items.map((item) => item.code.trim().toUpperCase()),
      'Competency item codes',
    );

    return this.competencyTemplateRepository.save(
      this.competencyTemplateRepository.create({
        companyId: actor.companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        status: 'ACTIVE',
        items: dto.items.map((item, index) => ({
          code: item.code.trim().toUpperCase(),
          name: item.name.trim(),
          description: item.description?.trim() ?? null,
          category: item.category,
          weight: String(item.weight),
          maximumRating: String(item.maximum_rating ?? 5),
          sortOrder: index,
        })),
      }),
    );
  }

  async listTemplates(actor: AuthenticatedUser): Promise<CompetencyTemplate[]> {
    if (!actor.companyId) {
      return [];
    }

    return this.competencyTemplateRepository.find({
      where: { companyId: actor.companyId },
      relations: { items: true },
      order: { id: 'DESC', items: { sortOrder: 'ASC', id: 'ASC' } },
    });
  }

  async scoreManagerRatings(
    companyId: number,
    performanceReviewId: number,
    ratings: Array<{
      template_item_code: string;
      rating: number;
      comment?: string;
    }>,
  ): Promise<{
    competencyScore: number;
    scoredItems: PerformanceCompetencyRating[];
  }> {
    const existingRatings = await this.competencyRatingRepository.find({
      where: { companyId, performanceReviewId },
      order: { id: 'ASC' },
    });

    if (existingRatings.length === 0) {
      throw new NotFoundException(
        'No competency ratings were initialized for this performance review.',
      );
    }

    const ratingMap = new Map(
      existingRatings.map((item) => [item.templateItemCode, item]),
    );

    for (const input of ratings) {
      const record = ratingMap.get(
        input.template_item_code.trim().toUpperCase(),
      );
      if (!record) {
        throw new BadRequestException(
          `Competency item ${input.template_item_code} is not assigned to this review.`,
        );
      }

      if (input.rating > Number(record.maximumRating)) {
        throw new BadRequestException(
          `Competency rating for ${record.templateItemCode} cannot exceed ${record.maximumRating}.`,
        );
      }

      record.managerRating = String(input.rating);
      record.managerComment = input.comment?.trim() ?? null;
    }

    await this.competencyRatingRepository.save(existingRatings);

    const competencyScore = existingRatings.reduce((sum, item) => {
      if (item.managerRating === null) {
        return sum;
      }

      return (
        sum +
        (Number(item.managerRating) / Number(item.maximumRating)) *
          Number(item.weight)
      );
    }, 0);

    return {
      competencyScore: Number(competencyScore.toFixed(4)),
      scoredItems: existingRatings,
    };
  }

  async initializeRatingsForReview(
    companyId: number,
    performanceReviewId: number,
    templateId: number,
  ): Promise<PerformanceCompetencyRating[]> {
    const template = await this.competencyTemplateRepository.findOne({
      where: { id: templateId, companyId },
      relations: { items: true },
    });

    if (!template) {
      throw new NotFoundException('Competency template not found.');
    }

    const existing = await this.competencyRatingRepository.find({
      where: { companyId, performanceReviewId },
    });
    if (existing.length > 0) {
      return existing;
    }

    const ratings = template.items.map((item) =>
      this.competencyRatingRepository.create({
        companyId,
        performanceReviewId,
        templateItemCode: item.code,
        templateItemName: item.name,
        category: item.category,
        weight: item.weight,
        maximumRating: item.maximumRating,
      }),
    );

    return this.competencyRatingRepository.save(ratings);
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-financial-year.service.ts

```typescript
import { assertDateRange } from '../utils/workflow-validation';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { HrAccessService } from '../../shared/hr-access.service';
import { PerformanceAuditActionEnum } from '../enums/performance-audit-action.enum';
import { PerformanceFinancialYear } from '../entities/performance-financial-year.entity';
import { CreatePerformanceFinancialYearDto } from '../dto/create-performance-financial-year.dto';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformanceAggregationMethodEnum } from '../enums/performance-aggregation-method.enum';

@Injectable()
export class PerformanceFinancialYearService {
  constructor(
    private readonly hrAccessService: HrAccessService,
    private readonly auditService: PerformanceAuditService,
    @InjectRepository(PerformanceFinancialYear)
    private readonly financialYearRepository: Repository<PerformanceFinancialYear>,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreatePerformanceFinancialYearDto,
  ): Promise<PerformanceFinancialYear> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);

    assertDateRange(dto.start_date, dto.end_date, 'Financial year');

    if (dto.start_date > dto.end_date) {
      throw new BadRequestException(
        'Financial year start date must be before or equal to the end date.',
      );
    }

    const overlap = await this.financialYearRepository
      .createQueryBuilder('year')
      .where('year.company_id = :companyId', { companyId })
      .andWhere('year.start_date <= :endDate', { endDate: dto.end_date })
      .andWhere('year.end_date >= :startDate', { startDate: dto.start_date })
      .getOne();

    if (overlap) {
      throw new ConflictException(
        'Financial year dates overlap an existing performance financial year.',
      );
    }

    const financialYear = await this.financialYearRepository.save(
      this.financialYearRepository.create({
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        startDate: dto.start_date,
        endDate: dto.end_date,
        status: 'DRAFT',
        annualAggregationMethod:
          dto.annual_aggregation_method ??
          PerformanceAggregationMethodEnum.SIMPLE_MONTHLY_AVERAGE,
        aggregationConfiguration: dto.aggregation_configuration ?? null,
        lockedByCompanyUserId: null,
      }),
    );

    await this.auditService.log({
      action: PerformanceAuditActionEnum.FINANCIAL_YEAR_CREATED,
      actor,
      afterValues: {
        financial_year_id: financialYear.id,
        code: financialYear.code,
      },
    });

    return financialYear;
  }

  async list(actor: AuthenticatedUser): Promise<PerformanceFinancialYear[]> {
    const companyId = this.hrAccessService.ensureActorCompanyId(actor);

    return this.financialYearRepository.find({
      where: { companyId },
      order: { startDate: 'DESC', id: 'DESC' },
    });
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-review.concurrency.postgres.spec.ts

```typescript
import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, EntitySchema } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { HrAccessService } from '../../shared/hr-access.service';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceAuditService } from './performance-audit.service';
import { PerformanceCompetencyService } from './performance-competency.service';
import { PerformanceImprovementPlanService } from './performance-improvement-plan.service';
import { PerformanceScorecardService } from './performance-scorecard.service';
import { PerformanceWorkflowService } from './performance-workflow.service';
import { PerformancePeriodAssignment } from '../entities/performance-period-assignment.entity';
import { PerformancePeriod } from '../entities/performance-period.entity';
import { PerformanceReview } from '../entities/performance-review.entity';
import { KpiAchievement } from '../entities/kpi-achievement.entity';
import { PerformanceRatingScale } from '../entities/performance-rating-scale.entity';
import { PerformanceReviewModeration } from '../entities/performance-review-moderation.entity';
import { Company } from '../../../companies/entities/company.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Department } from '../../departments/entities/department.entity';
import { PerformanceWorkflowConfig } from '../entities/performance-workflow-config.entity';
import { PerformanceReviewWorkflowStep } from '../entities/performance-review-workflow-step.entity';
import { PerformanceWorkflowStepTypeEnum } from '../enums/performance-workflow-step-type.enum';
import { PerformanceAppeal } from '../entities/performance-appeal.entity';

const databaseUrl = process.env.HRMS_WORKFLOW_TEST_DATABASE_URL;
const postgresSuite = databaseUrl ? describe : describe.skip;
postgresSuite('performance review concurrency with real PostgreSQL', () => {
  const schema = `hrms_workflow_${randomUUID().replace(/-/g, '')}`;
  let source: DataSource;
  let service: PerformanceReviewService;
  let workflow: PerformanceWorkflowService;
  let closeWorkflow: () => Promise<void>;
  let closeModule: () => Promise<void>;
  const actor: AuthenticatedUser = {
    id: 1,
    email: 'employee@example.test',
    scope: 'company',
    userType: 'COMPANY_USER',
    companyId: 1,
    companyMembershipId: 1,
    employeeId: 10,
    roles: [],
    permissions: [],
  };

  beforeAll(async () => {
    if (!new URL(databaseUrl!).pathname.endsWith('_e2e'))
      throw new Error('A dedicated _e2e database is required.');
    const assignments = new EntitySchema<PerformancePeriodAssignment>({
      name: 'PerformancePeriodAssignment',
      target: PerformancePeriodAssignment,
      tableName: 'assignments',
      schema,
      columns: {
        id: { type: Number, primary: true },
        companyId: { type: Number },
        employeeId: { type: Number },
        performancePeriodId: { type: Number },
        managerEmployeeId: { type: Number },
        status: { type: String },
      },
    });
    const periods = new EntitySchema<PerformancePeriod>({
      name: 'PerformancePeriod',
      target: PerformancePeriod,
      tableName: 'periods',
      schema,
      columns: {
        id: { type: Number, primary: true },
        companyId: { type: Number },
        status: { type: String },
        startDate: { type: 'date' },
        finalReviewDeadline: { type: 'date' },
        kpiPhase: { type: String, nullable: true },
      },
    });
    const reviews = new EntitySchema<PerformanceReview>({
      name: 'PerformanceReview',
      target: PerformanceReview,
      tableName: 'reviews',
      schema,
      columns: {
        id: { type: Number, primary: true, generated: true },
        companyId: { type: Number },
        performancePeriodId: { type: Number },
        periodAssignmentId: { type: Number },
        employeeId: { type: Number },
        managerEmployeeId: { type: Number },
        status: { type: String },
        adjustmentScore: { type: 'numeric', precision: 12, scale: 4 },
        employeeSelfReview: { type: 'jsonb', nullable: true },
      },
      uniques: [
        { columns: ['companyId', 'performancePeriodId', 'employeeId'] },
      ],
    });
    const companies = new EntitySchema<Company>({
      name: 'Company',
      target: Company,
      tableName: 'companies',
      schema,
      columns: { id: { type: Number, primary: true } },
    });
    const workflowConfigs = new EntitySchema<PerformanceWorkflowConfig>({
      name: 'PerformanceWorkflowConfig',
      target: PerformanceWorkflowConfig,
      tableName: 'workflows',
      schema,
      columns: {
        id: { type: Number, primary: true, generated: true },
        companyId: { type: Number },
        code: { type: String },
        name: { type: String },
        isDefault: { type: Boolean },
        status: { type: String },
        steps: { type: 'jsonb' },
      },
      uniques: [{ columns: ['companyId', 'code'] }],
    });
    source = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      schema,
      entities: [assignments, periods, reviews, companies, workflowConfigs],
      synchronize: false,
      logging: false,
      extra: { max: 8, options: `-c search_path=${schema},public` },
    });
    await source.initialize();
    await source.query(`CREATE SCHEMA "${schema}"`);
    await source.synchronize();
    const module = await Test.createTestingModule({
      providers: [
        PerformanceReviewService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: HrAccessService,
          useValue: {
            ensureActorCompanyId: () => 1,
            hasCompanyScope: () => true,
          },
        },
        {
          provide: PerformanceAuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PerformanceCompetencyService, useValue: {} },
        { provide: PerformanceImprovementPlanService, useValue: {} },
        { provide: PerformanceScorecardService, useValue: {} },
        { provide: PerformanceWorkflowService, useValue: {} },
        {
          provide: getRepositoryToken(PerformancePeriodAssignment),
          useValue: source.getRepository(PerformancePeriodAssignment),
        },
        {
          provide: getRepositoryToken(PerformanceReview),
          useValue: source.getRepository(PerformanceReview),
        },
        ...[
          KpiAchievement,
          PerformanceRatingScale,
          PerformanceReviewModeration,
          PerformanceAppeal,
        ].map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: {},
        })),
      ],
    }).compile();
    service = module.get(PerformanceReviewService);
    closeModule = () => module.close();
    const workflowModule = await Test.createTestingModule({
      providers: [
        PerformanceWorkflowService,
        {
          provide: HrAccessService,
          useValue: { ensureActorCompanyId: () => 1 },
        },
        {
          provide: PerformanceAuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: getRepositoryToken(PerformanceWorkflowConfig),
          useValue: source.getRepository(PerformanceWorkflowConfig),
        },
        ...[
          PerformanceReviewWorkflowStep,
          PerformanceReview,
          PerformancePeriodAssignment,
          Employee,
          Department,
        ].map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: {},
        })),
      ],
    }).compile();
    workflow = workflowModule.get(PerformanceWorkflowService);
    closeWorkflow = () => workflowModule.close();
    await source.query(`INSERT INTO "${schema}".companies VALUES (1)`);
    await source.query(
      `INSERT INTO "${schema}".periods VALUES (5, 1, 'OPEN', '2020-01-01', '2099-01-01', NULL)`,
    );
    await source.query(
      `INSERT INTO "${schema}".assignments VALUES (7, 1, 10, 5, 20, 'SELF_REVIEW')`,
    );
  });
  afterAll(async () => {
    if (closeModule) await closeModule();
    if (closeWorkflow) await closeWorkflow();
    if (source?.isInitialized) {
      try {
        await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await source.destroy();
      }
    }
  });

  it('allows only one concurrent self submission and persists one consistent next stage', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        service.submitSelfReview(actor, 7, {
          review: { comment: `Evidence ${index}` },
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failures = results.filter((result) => result.status === 'rejected');
    expect(failures).toHaveLength(5);
    for (const failure of failures)
      if (failure.status === 'rejected')
        expect(failure.reason).toBeInstanceOf(ConflictException);
    const reviews = await source.getRepository(PerformanceReview).find();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].status).toBe('MANAGER_REVIEW_PENDING');
    const assignment = await source
      .getRepository(PerformancePeriodAssignment)
      .findOneByOrFail({ id: 7 });
    expect(assignment.status).toBe('MANAGER_REVIEW');
  });
  const steps = [
    {
      code: 'HR',
      label: 'HR approval',
      type: PerformanceWorkflowStepTypeEnum.HR_REVIEW,
      sequence_number: 1,
    },
  ];
  it('retains the existing default after a duplicate configuration fails', async () => {
    await workflow.create(actor, {
      code: 'DEFAULT',
      name: 'Existing workflow',
      is_default: true,
      steps,
    });
    await expect(
      workflow.create(actor, {
        code: 'DEFAULT',
        name: 'Duplicate workflow',
        is_default: true,
        steps,
      }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
    const defaults = await source
      .getRepository(PerformanceWorkflowConfig)
      .find({ where: { companyId: 1, isDefault: true } });
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe('Existing workflow');
  });
  it('serializes concurrent default configuration switches', async () => {
    await Promise.all(
      ['FIRST', 'SECOND', 'THIRD'].map((code) =>
        workflow.create(actor, { code, name: code, is_default: true, steps }),
      ),
    );
    expect(
      await source
        .getRepository(PerformanceWorkflowConfig)
        .count({ where: { companyId: 1, isDefault: true } }),
    ).toBe(1);
  });
});
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/dto/activity.dto.ts

```typescript
import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  MinLength,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  DailyActivityReviewDecisionEnum,
  DailyActivityPriorityEnum,
  DailyActivitySourceEnum,
  DailyActivityStatusEnum,
  FieldPartyTypeEnum,
} from '../enums/work-activity.enums';

export class CreateActivityCategoryDto {
  @IsString()
  @MaxLength(80)
  code: string;

  @IsString()
  @MaxLength(180)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  department_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grade_id?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requires_time?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requires_outcome?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requires_evidence?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requires_location?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_field_activity?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  default_kpi_code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  display_order?: number;
}

export class UpdateActivityCategoryDto extends PartialType(
  CreateActivityCategoryDto,
) {}

export class CreateActivityPolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  department_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grade_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employment_type?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  daily_submission_required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  submission_cutoff_time?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  manager_review_required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimum_activity_count?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimum_completed_activity_count?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  field_visit_plan_required?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allow_unplanned_visits?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  require_visit_selfie?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  require_device_binding?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maximum_backdate_days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;
}

export class UpdateActivityPolicyDto extends PartialType(
  CreateActivityPolicyDto,
) {}

export class CreateDailyActivityReportDto {
  @IsDateString()
  activity_date: string;

  @IsOptional()
  @IsUUID()
  client_request_id?: string;

  @IsOptional()
  @IsEnum(DailyActivitySourceEnum)
  source?: DailyActivitySourceEnum;
}

export class ActivityChecklistItemDto {
  @IsString()
  @MaxLength(80)
  @MinLength(1)
  id: string;

  @IsString()
  @MaxLength(250)
  @MinLength(1)
  title: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  completed?: boolean;
}

export class CreateManagerActivityTaskDto {
  @ValidateIf(
    (dto: CreateManagerActivityTaskDto) =>
      !Array.isArray(dto.employee_ids) || dto.employee_ids.length === 0,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employee_id?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Type(() => Number)
  employee_ids?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  activity_category_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employee_kpi_id?: number;

  @IsDateString()
  activity_date: string;

  @IsString()
  @MaxLength(250)
  @MinLength(1)
  title: string;

  @IsString()
  @MaxLength(4000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expected_result?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsDateString()
  planned_start_time?: string;

  @IsOptional()
  @IsDateString()
  planned_end_time?: string;

  @IsOptional()
  @IsEnum(DailyActivityPriorityEnum)
  priority?: DailyActivityPriorityEnum;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((item: unknown) =>
    item !== null && typeof item === 'object' && 'id' in item
      ? item.id
      : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => ActivityChecklistItemDto)
  checklist?: ActivityChecklistItemDto[];
}

export class CreateSelfActivityTaskDto extends OmitType(
  CreateManagerActivityTaskDto,
  ['employee_id', 'employee_ids'] as const,
) {}

export class CreateDailyActivityEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  activity_category_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kpi_definition_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employee_kpi_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  project_reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  task_reference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  field_party_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  external_reference_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  external_reference_id?: string;

  @IsString()
  @MaxLength(250)
  @MinLength(1)
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expected_result?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsDateString()
  planned_start_time?: string;

  @IsOptional()
  @IsDateString()
  planned_end_time?: string;

  @IsOptional()
  @IsDateString()
  actual_start_time?: string;

  @IsOptional()
  @IsDateString()
  actual_end_time?: string;

  @IsOptional()
  @IsEnum(DailyActivityStatusEnum)
  status?: DailyActivityStatusEnum;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  defer_reason?: string;

  @IsOptional()
  @IsDateString()
  follow_up_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  completion_percentage?: number;

  @IsOptional()
  @IsUUID()
  client_request_id?: string;

  @IsOptional()
  @IsEnum(DailyActivityPriorityEnum)
  priority?: DailyActivityPriorityEnum;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((item: unknown) =>
    item !== null && typeof item === 'object' && 'id' in item
      ? item.id
      : undefined,
  )
  @ValidateNested({ each: true })
  @Type(() => ActivityChecklistItemDto)
  checklist?: ActivityChecklistItemDto[];
}

export class UpdateDailyActivityEntryDto extends PartialType(
  CreateDailyActivityEntryDto,
) {}

export class AddDailyActivityEvidenceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  document_id: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SubmitDailyActivityReportDto {
  @IsString()
  @MaxLength(5000)
  @MinLength(1)
  employee_summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  overall_remarks?: string;

  @IsUUID()
  client_request_id: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  entry_ids?: number[];
}

export class DailyActivityEntryReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entry_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  manager_comment?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  manager_validated?: boolean;
}

export class ReviewDailyActivityReportDto {
  @IsEnum(DailyActivityReviewDecisionEnum)
  decision: DailyActivityReviewDecisionEnum;

  @IsString()
  @MaxLength(5000)
  comments: string;

  @IsOptional()
  @IsNumberString()
  rating?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyActivityEntryReviewDto)
  entry_reviews?: DailyActivityEntryReviewDto[];
}

export class CreateDailyActivityCommentDto {
  @IsString()
  @MaxLength(3000)
  body: string;
}

export class CreateFieldPartyDto {
  @IsEnum(FieldPartyTypeEnum)
  party_type: FieldPartyTypeEnum;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  location_radius_meters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source_system?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  external_reference?: string;

  @IsOptional()
  @IsObject()
  external_snapshot?: Record<string, unknown>;
}

export class UpdateFieldPartyDto extends PartialType(CreateFieldPartyDto) {}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/manager-activities.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import {
  Permissions,
  PermissionsAny,
} from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import {
  CreateManagerActivityTaskDto,
  CreateDailyActivityCommentDto,
  ReviewDailyActivityReportDto,
  UpdateDailyActivityEntryDto,
} from '../dto/activity.dto';
import { WorkActivityQueryDto } from '../dto/queries.dto';
import { ActivityPolicyService } from '../services/activity-policy.service';
import { DailyActivityService } from '../services/daily-activity.service';
import { WorkActivityInsightsService } from '../services/work-activity-insights.service';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Manager Activities')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller('manager/activities')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
export class ManagerActivitiesController {
  constructor(
    private readonly dailyActivityService: DailyActivityService,
    private readonly insightsService: WorkActivityInsightsService,
    private readonly policyService: ActivityPolicyService,
  ) {}

  @Get('dashboard')
  @Permissions('work_activities:manager:read')
  getDashboard(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.insightsService.getManagerSummary(
      req.user,
      query.date_from,
      query.date_to,
    );
  }

  @Get('team')
  @Permissions('work_activities:manager:read')
  listTeamReports(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.dailyActivityService.listForManager(req.user, query);
  }

  @Get('tasks')
  @Permissions('work_activities:manager:read')
  listTasks(@Req() req: AuthedRequest, @Query() query: WorkActivityQueryDto) {
    return this.dailyActivityService.listManagerTasks(req.user, query);
  }

  @Get('assignees')
  @PermissionsAny(
    'work_activities:manager:read',
    'work_activities:manager:review',
  )
  listAssignees(@Req() req: AuthedRequest) {
    return this.dailyActivityService.listManagerAssignees(req.user);
  }

  @Get('pending-reviews')
  @Permissions('work_activities:manager:read')
  pendingReviews(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.dailyActivityService.listPendingReviews(req.user, query);
  }

  @Get('categories')
  @PermissionsAny(
    'work_activities:manager:read',
    'work_activities:manager:review',
    'work_activities:config',
  )
  listCategories(@Req() req: AuthedRequest) {
    return this.policyService.listCategories(req.user);
  }

  @Post('tasks')
  @Permissions('work_activities:manager:review')
  createTask(
    @Req() req: AuthedRequest,
    @Body() dto: CreateManagerActivityTaskDto,
  ) {
    return this.dailyActivityService.createManagerTask(req.user, dto);
  }

  @Post('entries/:entryId/comments')
  @PermissionsAny(
    'work_activities:manager:read',
    'work_activities:manager:review',
  )
  addComment(
    @Req() req: AuthedRequest,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: CreateDailyActivityCommentDto,
  ) {
    return this.dailyActivityService.addManagerComment(req.user, entryId, dto);
  }

  @Patch('entries/:entryId/schedule')
  @Permissions('work_activities:manager:review')
  updateEntrySchedule(
    @Req() req: AuthedRequest,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateDailyActivityEntryDto,
  ) {
    return this.dailyActivityService.updateManagerEntrySchedule(
      req.user,
      entryId,
      dto,
    );
  }

  @Get('reports/:id')
  @Permissions('work_activities:manager:read')
  getReport(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.dailyActivityService.getForManager(req.user, id);
  }

  @Post('reports/:id/review')
  @Permissions('work_activities:manager:review')
  review(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewDailyActivityReportDto,
  ) {
    return this.dailyActivityService.reviewDailyActivity(req.user, id, dto);
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/work-activities-admin.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import {
  CreateActivityCategoryDto,
  CreateActivityPolicyDto,
  CreateFieldPartyDto,
  UpdateActivityCategoryDto,
  UpdateActivityPolicyDto,
  UpdateFieldPartyDto,
} from '../dto/activity.dto';
import {
  FieldLocationMapQueryDto,
  WorkActivityQueryDto,
} from '../dto/queries.dto';
import { ActivityPolicyService } from '../services/activity-policy.service';
import { DailyActivityService } from '../services/daily-activity.service';
import { FieldPartyService } from '../services/field-party.service';
import { FieldVisitService } from '../services/field-visit.service';
import { WorkActivityExceptionService } from '../services/work-activity-exception.service';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Work Activities Administration')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller()
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
export class WorkActivitiesAdminController {
  constructor(
    private readonly policyService: ActivityPolicyService,
    private readonly dailyActivityService: DailyActivityService,
    private readonly fieldPartyService: FieldPartyService,
    private readonly visitService: FieldVisitService,
    private readonly exceptionService: WorkActivityExceptionService,
  ) {}

  @Post('activity-categories')
  @Permissions('work_activities:config')
  createCategory(
    @Req() req: AuthedRequest,
    @Body() dto: CreateActivityCategoryDto,
  ) {
    return this.policyService.createCategory(req.user, dto as never);
  }

  @Get('activity-categories')
  @Permissions('work_activities:config')
  listCategories(@Req() req: AuthedRequest) {
    return this.policyService.listCategories(req.user);
  }

  @Patch('activity-categories/:id')
  @Permissions('work_activities:config')
  updateCategory(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityCategoryDto,
  ) {
    return this.policyService.updateCategory(req.user, id, dto as never);
  }

  @Post('activity-categories/:id/deactivate')
  @Permissions('work_activities:config')
  deactivateCategory(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.policyService.deactivateCategory(req.user, id);
  }

  @Post('activity-policies')
  @Permissions('work_activities:config')
  createPolicy(
    @Req() req: AuthedRequest,
    @Body() dto: CreateActivityPolicyDto,
  ) {
    return this.policyService.createPolicy(req.user, dto as never);
  }

  @Get('activity-policies')
  @Permissions('work_activities:config')
  listPolicies(@Req() req: AuthedRequest) {
    return this.policyService.listPolicies(req.user);
  }

  @Patch('activity-policies/:id')
  @Permissions('work_activities:config')
  updatePolicy(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityPolicyDto,
  ) {
    return this.policyService.updatePolicy(req.user, id, dto as never);
  }

  @Post('field-parties')
  @Permissions('field_visits:config')
  createFieldParty(
    @Req() req: AuthedRequest,
    @Body() dto: CreateFieldPartyDto,
  ) {
    return this.fieldPartyService.create(req.user, dto as never);
  }

  @Get('field-parties')
  @Permissions('field_visits:config')
  listFieldParties(@Req() req: AuthedRequest) {
    return this.fieldPartyService.list(req.user);
  }

  @Get('field-parties/:id')
  @Permissions('field_visits:config')
  getFieldParty(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.fieldPartyService.get(req.user, id);
  }

  @Patch('field-parties/:id')
  @Permissions('field_visits:config')
  updateFieldParty(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFieldPartyDto,
  ) {
    return this.fieldPartyService.update(req.user, id, dto as never);
  }

  @Get('hr/activities')
  @Permissions('work_activities:hr:read')
  getActivitySummary(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.dailyActivityService.listForHr(req.user, query);
  }

  @Get('hr/field-visits')
  @Permissions('field_visits:hr:read')
  getVisitSummary(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.visitService.listForHr(req.user, query);
  }

  @Get('hr/field-visits/map')
  @Permissions('field_locations:export')
  getVisitMap(
    @Req() req: AuthedRequest,
    @Query() query: FieldLocationMapQueryDto,
  ) {
    return this.visitService.getMapPoints(req.user, query);
  }

  @Get('hr/field-locations/access-logs')
  @Permissions('field_locations:read')
  getLocationAccessLog(@Req() req: AuthedRequest) {
    return this.visitService.listLocationAccessLogs(req.user);
  }

  @Get('hr/activity-exceptions')
  @Permissions('work_activities:hr:read')
  getActivityExceptions(
    @Req() req: AuthedRequest,
    @Query() query: WorkActivityQueryDto,
  ) {
    return this.exceptionService.list(req.user.companyId!, {
      employeeId: (query as WorkActivityQueryDto & { employee_id?: number })
        .employee_id,
      status: query.status,
    });
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/controllers/my-daily-activities.controller.ts

```typescript
import { UseFilters } from '@nestjs/common';
import { WorkflowDatabaseExceptionFilter } from '../../../../common/filters/workflow-database-exception.filter';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Permissions } from '../../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { TenantGuard } from '../../../../common/guards/tenant.guard';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import {
  AddDailyActivityEvidenceDto,
  CreateDailyActivityEntryDto,
  CreateDailyActivityCommentDto,
  CreateDailyActivityReportDto,
  CreateSelfActivityTaskDto,
  SubmitDailyActivityReportDto,
  UpdateDailyActivityEntryDto,
} from '../dto/activity.dto';
import { WorkActivityQueryDto } from '../dto/queries.dto';
import { DailyActivityService } from '../services/daily-activity.service';

type AuthedRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('My Daily Activities')
@ApiBearerAuth('access-token')
@UseFilters(WorkflowDatabaseExceptionFilter)
@Controller('me/activities')
@UseGuards(AuthGuard('jwt'), TenantGuard, PermissionsGuard)
export class MyDailyActivitiesController {
  constructor(private readonly service: DailyActivityService) {}

  @Get()
  @Permissions('work_activities:self-service:read')
  list(@Req() req: AuthedRequest, @Query() query: WorkActivityQueryDto) {
    return this.service.listMine(req.user, query);
  }

  @Get('today')
  @Permissions('work_activities:self-service:read')
  getToday(@Req() req: AuthedRequest) {
    return this.service.getOrCreateMyDailyReport(
      req.user,
      new Date().toISOString().slice(0, 10),
    );
  }

  @Get('tasks')
  @Permissions('work_activities:self-service:read')
  listTasks(@Req() req: AuthedRequest, @Query() query: WorkActivityQueryDto) {
    return this.service.listMineTasks(req.user, query);
  }

  @Post('tasks')
  @Permissions('work_activities:self-service:update')
  createTask(
    @Req() req: AuthedRequest,
    @Body() dto: CreateSelfActivityTaskDto,
  ) {
    return this.service.createMyTask(req.user, dto);
  }

  @Post('reports')
  @Permissions('work_activities:self-service:update')
  createReport(
    @Req() req: AuthedRequest,
    @Body() dto: CreateDailyActivityReportDto,
  ) {
    return this.service.getOrCreateMyDailyReport(
      req.user,
      dto.activity_date,
      dto.client_request_id,
      dto.source,
    );
  }

  @Get('reports/:id')
  @Permissions('work_activities:self-service:read')
  getReport(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.getMine(req.user, id);
  }

  @Post('reports/:id/entries')
  @Permissions('work_activities:self-service:update')
  addEntry(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) reportId: number,
    @Body() dto: CreateDailyActivityEntryDto,
  ) {
    return this.service.addMyEntry(req.user, reportId, dto);
  }

  @Patch('reports/:id/entries/:entryId')
  @Permissions('work_activities:self-service:update')
  updateEntry(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) reportId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateDailyActivityEntryDto,
  ) {
    return this.service.updateMyEntry(req.user, reportId, entryId, dto);
  }

  @Delete('reports/:id/entries/:entryId')
  @Permissions('work_activities:self-service:update')
  removeEntry(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) reportId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
  ) {
    return this.service.removeMyEntry(req.user, reportId, entryId);
  }

  @Post('entries/:entryId/evidence')
  @Permissions('work_activities:self-service:update')
  addEvidence(
    @Req() req: AuthedRequest,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: AddDailyActivityEvidenceDto,
  ) {
    return this.service.addMyEvidence(req.user, entryId, dto);
  }

  @Post('entries/:entryId/comments')
  @Permissions('work_activities:self-service:update')
  addComment(
    @Req() req: AuthedRequest,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: CreateDailyActivityCommentDto,
  ) {
    return this.service.addMyComment(req.user, entryId, dto);
  }

  @Post('reports/:id/submit')
  @Permissions('work_activities:self-service:update')
  submit(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) reportId: number,
    @Body() dto: SubmitDailyActivityReportDto,
  ) {
    return this.service.submitMyDailyReport(req.user, reportId, dto);
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/daily-activity.service.ts

```typescript
import { Document } from '../../documents/entities/document.entity';
import { DocumentEntityTypeEnum } from '../../documents/enums/document-entity-type.enum';
import {
  assertDateRange,
  assertUniqueValues,
} from '../../performance/utils/workflow-validation';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActionItemTypeEnum } from '../../action-inbox/enums/action-item-type.enum';
import { ActionItemsService } from '../../action-inbox/action-items.service';
import { AttendanceDailySummary } from '../../attendance/processing/entities/attendance-daily-summary.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { EmploymentStatusEnum } from '../../employees/enums/employment-status.enum';
import { HrAccessService } from '../../shared/hr-access.service';
import {
  AddDailyActivityEvidenceDto,
  CreateDailyActivityCommentDto,
  CreateDailyActivityEntryDto,
  CreateManagerActivityTaskDto,
  CreateSelfActivityTaskDto,
  UpdateDailyActivityEntryDto,
  SubmitDailyActivityReportDto,
  ReviewDailyActivityReportDto,
} from '../dto/activity.dto';
import { WorkActivityQueryDto } from '../dto/queries.dto';
import { ActivityCategory } from '../entities/activity-config.entities';
import {
  DailyActivityEntry,
  DailyActivityEvidence,
  DailyActivityComment,
  DailyActivityReport,
} from '../entities/daily-activity.entities';
import {
  DailyActivityEntryReviewStatusEnum,
  DailyActivityOriginEnum,
  DailyActivityReportStatusEnum,
  DailyActivityPriorityEnum,
  DailyActivityReviewDecisionEnum,
  DailyActivitySourceEnum,
  DailyActivityStatusEnum,
} from '../enums/work-activity.enums';
import { EmployeeKpi } from '../../performance/entities/employee-kpi.entity';
import { EmployeeKpiStatusEnum } from '../../performance/enums/employee-kpi-status.enum';
import { PerformancePeriodStatusEnum } from '../../performance/enums/performance-period-status.enum';
import { ActivityPolicyService } from './activity-policy.service';
import { WorkActivityAuditService } from './work-activity-audit.service';
import { WorkActivityExceptionService } from './work-activity-exception.service';
import { DefaultAvatarsService } from '../../default-avatars/default-avatars.service';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationCategoryEnum } from '../../../notifications/enums/notification-category.enum';
import { NotificationChannelEnum } from '../../../notifications/enums/notification-channel.enum';
import { NotificationPriorityEnum } from '../../../notifications/enums/notification-priority.enum';
import { NotificationTypeEnum } from '../../../notifications/enums/notification-type.enum';

@Injectable()
export class DailyActivityService {
  private readonly logger = new Logger(DailyActivityService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly hrAccessService: HrAccessService,
    private readonly actionItemsService: ActionItemsService,
    private readonly notificationsService: NotificationsService,
    private readonly policyService: ActivityPolicyService,
    private readonly auditService: WorkActivityAuditService,
    private readonly exceptionService: WorkActivityExceptionService,
    private readonly defaultAvatarsService: DefaultAvatarsService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(ActivityCategory)
    private readonly categoryRepository: Repository<ActivityCategory>,
    @InjectRepository(DailyActivityReport)
    private readonly reportRepository: Repository<DailyActivityReport>,
    @InjectRepository(DailyActivityEntry)
    private readonly entryRepository: Repository<DailyActivityEntry>,
    @InjectRepository(DailyActivityEvidence)
    private readonly evidenceRepository: Repository<DailyActivityEvidence>,
    @InjectRepository(DailyActivityComment)
    private readonly commentRepository: Repository<DailyActivityComment>,
    @InjectRepository(AttendanceDailySummary)
    private readonly attendanceRepository: Repository<AttendanceDailySummary>,
    @InjectRepository(EmployeeKpi)
    private readonly employeeKpiRepository: Repository<EmployeeKpi>,
  ) {}

  private getCompanyId(actor: AuthenticatedUser): number {
    return this.hrAccessService.ensureActorCompanyId(actor);
  }

  private getEmployeeId(actor: AuthenticatedUser): number {
    if (!actor.employeeId) {
      throw new ForbiddenException('Employee profile is required.');
    }
    return actor.employeeId;
  }

  private toText(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    return fallback;
  }

  private async getEmployee(companyId: number, employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, company_id: companyId },
      relations: { default_avatar: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  async listMine(actor: AuthenticatedUser, query: WorkActivityQueryDto) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .where('report.companyId = :companyId', { companyId })
      .andWhere('report.employeeId = :employeeId', { employeeId })
      .orderBy('report.activityDate', 'DESC')
      .addOrderBy('report.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.date_from) {
      qb.andWhere('report.activityDate >= :dateFrom', {
        dateFrom: query.date_from,
      });
    }
    if (query.date_to) {
      qb.andWhere('report.activityDate <= :dateTo', { dateTo: query.date_to });
    }
    if (query.status) {
      qb.andWhere('report.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: await Promise.all(
        items.map((item) => this.getReportResponse(item)),
      ),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async listForManager(actor: AuthenticatedUser, query: WorkActivityQueryDto) {
    return this.listScoped(actor, query, false);
  }

  async listMineTasks(actor: AuthenticatedUser, query: WorkActivityQueryDto) {
    const reports = await this.listMine(actor, { ...query, limit: 100 });
    return this.filterTaskRows(this.flattenTaskRows(reports.data), query);
  }

  async listManagerTasks(
    actor: AuthenticatedUser,
    query: WorkActivityQueryDto,
  ) {
    const reports = await this.listForManager(actor, { ...query, limit: 100 });
    const flattened = this.flattenTaskRows(reports.data);
    const actorEmployeeId = actor.employeeId ?? null;
    const data = flattened.data.filter((row) => {
      const employeeId = Number(row.employee_id ?? row.employeeId);
      if (actorEmployeeId != null && employeeId === actorEmployeeId) {
        return false;
      }
      return this.isManagerAssignedTaskRow(row);
    });
    return {
      ...this.filterTaskRows({ data, meta: { total: data.length } }, query),
    };
  }

  async listManagerAssignees(actor: AuthenticatedUser) {
    const companyId = this.getCompanyId(actor);
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.primary_department', 'department')
      .leftJoinAndSelect('employee.primary_position', 'position')
      .leftJoinAndSelect('employee.default_avatar', 'defaultAvatar')
      .where('employee.company_id = :companyId', { companyId })
      .andWhere('employee.employment_status = :employmentStatus', {
        employmentStatus: EmploymentStatusEnum.ACTIVE,
      })
      .andWhere('employee.id != :actorEmployeeId', {
        actorEmployeeId: actor.employeeId ?? -1,
      });
    const accessibleEmployeeIds =
      await this.hrAccessService.getAccessibleEmployeeIds(actor);
    if (accessibleEmployeeIds !== null) {
      if (accessibleEmployeeIds.length === 0) return [];
      qb.andWhere('employee.id IN (:...accessibleEmployeeIds)', {
        accessibleEmployeeIds,
      });
    }
    const employees = await qb
      .orderBy('employee.first_name', 'ASC')
      .addOrderBy('employee.last_name', 'ASC')
      .getMany();
    return Promise.all(
      employees.map(async (employee) => {
        const photo = await this.employeePhotoUrl(employee);
        return {
          id: employee.id,
          employee_no: employee.employee_no,
          full_name: [
            employee.first_name,
            employee.middle_name,
            employee.last_name,
          ]
            .filter(Boolean)
            .join(' '),
          profile_photo_url: photo,
          department: employee.primary_department,
          position: employee.primary_position,
        };
      }),
    );
  }

  private isManagerAssignedTaskRow(row: Record<string, unknown>) {
    const candidates = [
      row.taskReference,
      row.task_reference,
      row.externalReferenceType,
      row.external_reference_type,
    ];
    const reference = (
      candidates.find((value): value is string => typeof value === 'string') ??
      ''
    ).toUpperCase();
    return reference.includes('MANAGER') && !reference.includes('SELF');
  }

  private flattenTaskRows(reports: Array<Record<string, unknown>>) {
    const data: Array<Record<string, unknown>> = [];
    for (const report of reports) {
      const entries = Array.isArray(report.entries) ? report.entries : [];
      for (const value of entries) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
          continue;
        data.push({
          ...(value as Record<string, unknown>),
          report_id: report.id,
          activity_date: report.activityDate,
          report_status: report.status,
          employee_id: report.employeeId,
          employee: report.employeeSnapshot,
        });
      }
    }

    return {
      data,
      meta: { total: data.length },
    };
  }

  private filterTaskRows(
    result: {
      data: Array<Record<string, unknown>>;
      meta: Record<string, unknown>;
    },
    query: WorkActivityQueryDto,
  ) {
    const now = new Date();
    const data = result.data.filter((row) => {
      if (
        query.employee_kpi_id !== undefined &&
        Number(row.employeeKpiId ?? row.employee_kpi_id) !==
          query.employee_kpi_id
      ) {
        return false;
      }
      if (
        query.assigned_by_employee_id !== undefined &&
        Number(row.assignedByEmployeeId ?? row.assigned_by_employee_id) !==
          query.assigned_by_employee_id
      ) {
        return false;
      }
      if (query.origin && row.origin !== query.origin) return false;
      if (query.work_status && row.status !== query.work_status) return false;
      if (
        query.review_status &&
        (row.reviewStatus ?? row.review_status) !== query.review_status
      ) {
        return false;
      }
      if (query.priority && row.priority !== query.priority) return false;
      if (query.overdue !== undefined) {
        const rawDueDate = row.dueDate ?? row.due_date ?? row.plannedEndTime;
        const dueDate =
          rawDueDate instanceof Date
            ? rawDueDate
            : typeof rawDueDate === 'string' || typeof rawDueDate === 'number'
              ? new Date(rawDueDate)
              : null;
        const overdue =
          dueDate !== null &&
          !Number.isNaN(dueDate.getTime()) &&
          dueDate < now &&
          ![
            DailyActivityStatusEnum.COMPLETED,
            DailyActivityStatusEnum.CANCELLED,
          ].includes(row.status as DailyActivityStatusEnum);
        if (overdue !== query.overdue) return false;
      }
      return true;
    });
    return { data, meta: { ...result.meta, total: data.length } };
  }

  private assigneeIdsFromDto(dto: CreateManagerActivityTaskDto) {
    return [
      ...new Set(
        [
          ...(Array.isArray(dto.employee_ids) ? dto.employee_ids : []),
          ...(dto.employee_id != null ? [dto.employee_id] : []),
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ];
  }

  async createManagerTask(
    actor: AuthenticatedUser,
    dto: CreateManagerActivityTaskDto,
  ) {
    assertDateRange(dto.activity_date, dto.due_date?.slice(0, 10), 'Activity');
    const assigneeIds = this.assigneeIdsFromDto(dto);
    if (assigneeIds.length === 0) {
      throw new BadRequestException('Choose at least one employee.');
    }
    if (assigneeIds.length === 1) {
      return this.createManagerTaskForEmployee(actor, {
        ...dto,
        employee_id: assigneeIds[0],
      });
    }

    const data: Array<
      Awaited<ReturnType<DailyActivityService['createManagerTaskForEmployee']>>
    > = [];
    for (const employeeId of assigneeIds) {
      data.push(
        await this.createManagerTaskForEmployee(actor, {
          ...dto,
          employee_id: employeeId,
        }),
      );
    }
    return {
      assigned: data.length,
      data,
    };
  }

  private async createManagerTaskForEmployee(
    actor: AuthenticatedUser,
    dto: CreateManagerActivityTaskDto & { employee_id: number },
  ) {
    const companyId = this.getCompanyId(actor);
    const employee = await this.getEmployee(companyId, dto.employee_id);
    await this.assertManagerCanAssign(actor, employee);
    await this.assertKpiLink(companyId, employee.id, dto.employee_kpi_id);
    const category = await this.resolveManagerTaskCategory(
      companyId,
      dto.activity_category_id,
    );
    const entryDto: CreateDailyActivityEntryDto = {
      activity_category_id: category.id,
      title: dto.title,
      description: dto.description,
      planned_start_time: dto.planned_start_time,
      planned_end_time: dto.planned_end_time,
      task_reference: 'MANAGER_ASSIGNED',
      status: DailyActivityStatusEnum.PLANNED,
      priority: dto.priority ?? DailyActivityPriorityEnum.MEDIUM,
      checklist: dto.checklist,
      employee_kpi_id: dto.employee_kpi_id,
      expected_result: dto.expected_result,
      due_date: dto.due_date,
    };
    this.validateEntry(entryDto, category);

    const created = await this.dataSource.transaction(async (manager) => {
      const report = await this.resolveEditableReport(manager, {
        companyId,
        employee,
        preferredDate: dto.activity_date,
        source: DailyActivitySourceEnum.SYSTEM,
        metadata: { manager_assigned_task: true },
      });
      const entry = await this.saveTaskEntry(manager, {
        actor,
        companyId,
        report,
        categoryId: category.id,
        dto,
        taskReference: 'MANAGER_ASSIGNED',
        externalReferenceType: 'MANAGER_TASK',
        origin: DailyActivityOriginEnum.ASSIGNED,
      });
      return {
        entry,
        response: await this.getReportResponse(report, manager),
      };
    });
    await this.auditService.log({
      action: 'DAILY_ACTIVITY_ASSIGNED',
      actor,
      employeeId: employee.id,
      entityType: 'DAILY_ACTIVITY_ENTRY',
      entityId: created.entry.id,
      afterValues: {
        title: created.entry.title,
        due_date: created.entry.dueDate,
        employee_kpi_id: created.entry.employeeKpiId,
      },
    });
    void this.notifyActivityAssigned(actor, employee, created.entry);
    return created.response;
  }

  async createMyTask(actor: AuthenticatedUser, dto: CreateSelfActivityTaskDto) {
    assertDateRange(dto.activity_date, dto.due_date?.slice(0, 10), 'Activity');
    const companyId = this.getCompanyId(actor);
    const employee = await this.getEmployee(
      companyId,
      this.getEmployeeId(actor),
    );
    const category = await this.resolveManagerTaskCategory(
      companyId,
      dto.activity_category_id,
    );
    await this.assertKpiLink(companyId, employee.id, dto.employee_kpi_id);
    const entryDto: CreateDailyActivityEntryDto = {
      activity_category_id: category.id,
      title: dto.title,
      description: dto.description,
      planned_start_time: dto.planned_start_time,
      planned_end_time: dto.planned_end_time,
      task_reference: 'SELF_CREATED',
      status: DailyActivityStatusEnum.PLANNED,
      priority: dto.priority ?? DailyActivityPriorityEnum.MEDIUM,
      checklist: dto.checklist,
      employee_kpi_id: dto.employee_kpi_id,
      expected_result: dto.expected_result,
      due_date: dto.due_date,
    };
    this.validateEntry(entryDto, category);

    const created = await this.dataSource.transaction(async (manager) => {
      const report = await this.resolveEditableReport(manager, {
        companyId,
        employee,
        preferredDate: dto.activity_date,
        source: DailyActivitySourceEnum.WEB,
        metadata: { self_created_task: true },
      });
      const entry = await this.saveTaskEntry(manager, {
        actor,
        companyId,
        report,
        categoryId: category.id,
        dto,
        taskReference: 'SELF_CREATED',
        externalReferenceType: 'SELF_TASK',
        origin: DailyActivityOriginEnum.SELF_CREATED,
      });
      return {
        entry,
        response: await this.getReportResponse(report, manager),
      };
    });
    await this.auditService.log({
      action: 'DAILY_ACTIVITY_CREATED',
      actor,
      employeeId: employee.id,
      entityType: 'DAILY_ACTIVITY_ENTRY',
      entityId: created.entry.id,
      afterValues: {
        title: created.entry.title,
        due_date: created.entry.dueDate,
        employee_kpi_id: created.entry.employeeKpiId,
      },
    });
    return created.response;
  }

  private isEditableReportStatus(status: DailyActivityReportStatusEnum) {
    return [
      DailyActivityReportStatusEnum.DRAFT,
      DailyActivityReportStatusEnum.RETURNED_FOR_CORRECTION,
    ].includes(status);
  }

  private addDays(date: string, days: number) {
    const value = new Date(`${date}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private dateOnly(value: Date | string | null | undefined) {
    if (!value) return '';
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? ''
        : value.toISOString().slice(0, 10);
    }
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? '';
  }

  private deferDateForEntry(entry: DailyActivityEntry, reportDate: string) {
    const due = this.dateOnly(entry.plannedEndTime);
    if (due && due > reportDate) return due;
    const start = this.dateOnly(entry.plannedStartTime);
    if (start && start > reportDate) return start;
    return this.addDays(reportDate, 1);
  }

  private async keepSelectedEntries(
    manager: EntityManager,
    report: DailyActivityReport,
    entries: DailyActivityEntry[],
    selectedIds: number[],
  ) {
    const selected = new Set(selectedIds.map((id) => Number(id)));
    const keep = entries.filter((entry) => selected.has(entry.id));
    const defer = entries.filter((entry) => !selected.has(entry.id));

    if (keep.length !== selected.size) {
      throw new BadRequestException(
        'One or more selected work items are not on this day.',
      );
    }
    if (keep.length === 0) {
      throw new BadRequestException(
        'Select at least one completed work item to close this day.',
      );
    }
    const incomplete = keep.filter(
      (entry) => entry.status !== DailyActivityStatusEnum.COMPLETED,
    );
    if (incomplete.length > 0) {
      throw new BadRequestException(
        'In-progress work cannot be submitted. Leave it unchecked so it stays open.',
      );
    }
    if (defer.length === 0) return keep;

    const employee = await this.getEmployee(
      report.companyId,
      report.employeeId,
    );
    const byDate = new Map<string, DailyActivityEntry[]>();
    for (const entry of defer) {
      const nextDate = this.deferDateForEntry(entry, report.activityDate);
      const bucket = byDate.get(nextDate) ?? [];
      bucket.push(entry);
      byDate.set(nextDate, bucket);
    }

    for (const [activityDate, moving] of byDate) {
      const target = await this.resolveEditableReport(manager, {
        companyId: report.companyId,
        employee,
        preferredDate: activityDate,
        source: DailyActivitySourceEnum.WEB,
        metadata: { deferred_from_report_id: report.id },
      });
      for (const entry of moving) {
        entry.dailyActivityReportId = target.id;
      }
      await manager.getRepository(DailyActivityEntry).save(moving);
    }

    return keep;
  }

  private async resolveEditableReport(
    manager: EntityManager,
    params: {
      companyId: number;
      employee: Employee;
      preferredDate: string;
      source: DailyActivitySourceEnum;
      metadata?: Record<string, unknown> | null;
    },
  ) {
    const { companyId, employee, preferredDate, source, metadata } = params;
    const repo = manager.getRepository(DailyActivityReport);

    const tryDate = async (activityDate: string) => {
      const existing = await repo.findOne({
        where: { companyId, employeeId: employee.id, activityDate },
      });
      if (!existing) {
        const policy = await this.policyService.resolveForEmployee(
          companyId,
          employee,
          activityDate,
        );
        return repo.save(
          repo.create({
            companyId,
            employeeId: employee.id,
            activityDate,
            status: DailyActivityReportStatusEnum.DRAFT,
            managerEmployeeId: employee.reports_to ?? null,
            managerCompanyUserId: await this.resolveManagerCompanyUserId(
              employee.reports_to,
            ),
            employeeSnapshot: await this.buildEmployeeSnapshot(employee),
            policySnapshot: this.normalizePolicySnapshot(policy),
            attendanceSnapshot: null,
            clientRequestId: null,
            source,
            metadata: metadata ?? null,
          }),
        );
      }
      return this.isEditableReportStatus(existing.status) ? existing : null;
    };

    const preferred = await tryDate(preferredDate);
    if (preferred) return preferred;

    for (let offset = 1; offset <= 14; offset += 1) {
      const next = await tryDate(this.addDays(preferredDate, offset));
      if (next) return next;
    }

    throw new ConflictException(
      'The report for this date is already submitted. Choose another start date.',
    );
  }

  private async saveTaskEntry(
    manager: EntityManager,
    params: {
      actor: AuthenticatedUser;
      companyId: number;
      report: DailyActivityReport;
      categoryId: number;
      dto: CreateManagerActivityTaskDto | CreateSelfActivityTaskDto;
      taskReference: string;
      externalReferenceType: string;
      origin: DailyActivityOriginEnum;
    },
  ) {
    const {
      actor,
      companyId,
      report,
      categoryId,
      dto,
      taskReference,
      externalReferenceType,
      origin,
    } = params;
    return manager.getRepository(DailyActivityEntry).save(
      manager.getRepository(DailyActivityEntry).create({
        companyId,
        dailyActivityReportId: report.id,
        activityCategoryId: categoryId,
        kpiDefinitionId: null,
        employeeKpiId: dto.employee_kpi_id ?? null,
        projectReference: null,
        taskReference,
        fieldPartyId: null,
        externalReferenceType,
        externalReferenceId: String(actor.id),
        title: dto.title.trim(),
        description: dto.description.trim(),
        expectedResult: dto.expected_result?.trim() ?? null,
        dueDate: dto.due_date ? new Date(dto.due_date) : null,
        completionDate: null,
        plannedStartTime: dto.planned_start_time
          ? new Date(dto.planned_start_time)
          : new Date(`${report.activityDate}T09:00:00.000Z`),
        plannedEndTime: dto.planned_end_time
          ? new Date(dto.planned_end_time)
          : null,
        actualStartTime: null,
        actualEndTime: null,
        status: DailyActivityStatusEnum.PLANNED,
        origin,
        reviewStatus: DailyActivityEntryReviewStatusEnum.NOT_REQUIRED,
        reviewedAt: null,
        reviewedByCompanyUserId: null,
        outcome: null,
        remarks: null,
        deferReason: null,
        followUpDate: null,
        completionPercentage: '0',
        managerComment: null,
        managerValidated: false,
        priority: dto.priority ?? DailyActivityPriorityEnum.MEDIUM,
        assignedByCompanyUserId: actor.companyMembershipId ?? actor.id ?? null,
        assignedByEmployeeId: actor.employeeId ?? null,
        assignedBySnapshot: actor.employeeId
          ? await this.buildEmployeeSnapshot(
              await this.getEmployee(companyId, actor.employeeId),
            )
          : null,
        checklist: (dto.checklist ?? []).map((item) => ({
          id: item.id,
          title: item.title.trim(),
          completed: item.completed === true,
        })),
        linkedFieldVisitId: null,
        clientRequestId: null,
      }),
    );
  }

  private async notifyActivityAssigned(
    actor: AuthenticatedUser,
    employee: Employee,
    entry: DailyActivityEntry,
  ): Promise<void> {
    if (!employee.company_user_id) return;
    try {
      await this.notificationsService.createAndPush({
        company_id: employee.company_id,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: employee.company_user_id,
        category: NotificationCategoryEnum.HR,
        priority:
          entry.priority === DailyActivityPriorityEnum.URGENT
            ? NotificationPriorityEnum.URGENT
            : NotificationPriorityEnum.MEDIUM,
        title: 'Activity assigned',
        message: entry.title,
        related_module: 'WORK_ACTIVITIES',
        entity_type: 'DAILY_ACTIVITY_ENTRY',
        entity_id: entry.id,
        action_url: `/dashboard/me/activities/today?task=${entry.id}`,
        dedupe_key: `activity-assigned:${entry.id}`,
      });
    } catch (error) {
      this.logger.warn(
        `Activity ${entry.id} was assigned, but notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async resolveManagerTaskCategory(
    companyId: number,
    categoryId?: number,
  ) {
    if (categoryId !== undefined) {
      return this.policyService.getCategoryOrFail(companyId, categoryId);
    }

    const existing = await this.categoryRepository.findOne({
      where: { companyId, code: 'MANAGER_ASSIGNED' },
    });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        existing.status = 'ACTIVE';
        return this.categoryRepository.save(existing);
      }
      return existing;
    }

    return this.categoryRepository.save(
      this.categoryRepository.create({
        companyId,
        code: 'MANAGER_ASSIGNED',
        name: 'Assigned task',
        description: 'Work assigned by a manager or team lead.',
        departmentId: null,
        positionId: null,
        gradeId: null,
        requiresTime: false,
        requiresOutcome: false,
        requiresEvidence: false,
        requiresLocation: false,
        isFieldActivity: false,
        defaultKpiCode: null,
        displayOrder: 999,
        status: 'ACTIVE',
      }),
    );
  }

  async listForHr(actor: AuthenticatedUser, query: WorkActivityQueryDto) {
    return this.listScoped(actor, query, true);
  }

  async getOrCreateMyDailyReport(
    actor: AuthenticatedUser,
    activityDate: string,
    clientRequestId?: string,
    source: DailyActivitySourceEnum = DailyActivitySourceEnum.WEB,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);

    return this.dataSource.transaction(async (manager) => {
      if (clientRequestId) {
        const existingByRequest = await manager
          .getRepository(DailyActivityReport)
          .findOne({
            where: { companyId, employeeId, clientRequestId },
          });
        if (existingByRequest) {
          return this.getReportResponse(existingByRequest, manager);
        }
      }

      const existing = await manager
        .getRepository(DailyActivityReport)
        .findOne({
          where: { companyId, employeeId, activityDate },
        });

      if (existing) {
        return this.getReportResponse(existing, manager);
      }

      const employee = await manager.getRepository(Employee).findOne({
        where: { id: employeeId, company_id: companyId },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found.');
      }

      const policy = await this.policyService.resolveForEmployee(
        companyId,
        employee,
        activityDate,
      );
      const managerCompanyUserId = await this.resolveManagerCompanyUserId(
        employee.reports_to,
      );

      const report = await manager.getRepository(DailyActivityReport).save(
        manager.getRepository(DailyActivityReport).create({
          companyId,
          employeeId,
          activityDate,
          status: DailyActivityReportStatusEnum.DRAFT,
          managerEmployeeId: employee.reports_to ?? null,
          managerCompanyUserId,
          employeeSnapshot: await this.buildEmployeeSnapshot(employee),
          policySnapshot: this.normalizePolicySnapshot(policy),
          attendanceSnapshot: null,
          clientRequestId: clientRequestId ?? null,
          source,
          metadata: null,
        }),
      );

      await this.auditService.log(
        {
          action: 'DAILY_ACTIVITY_REPORT_CREATED',
          actor,
          employeeId,
          entityType: 'DAILY_ACTIVITY_REPORT',
          entityId: report.id,
          afterValues: { activity_date: activityDate, source },
        },
        manager,
      );

      return this.getReportResponse(report, manager);
    });
  }

  async getMine(actor: AuthenticatedUser, id: number) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);
    const report = await this.reportRepository.findOne({
      where: { id, companyId, employeeId },
    });

    if (!report) {
      throw new NotFoundException('Daily activity report not found.');
    }

    return this.getReportResponse(report);
  }

  async addMyEntry(
    actor: AuthenticatedUser,
    reportId: number,
    dto: CreateDailyActivityEntryDto,
  ) {
    const report = await this.lockMyEditableReport(actor, reportId);
    const category = await this.policyService.getCategoryOrFail(
      report.companyId,
      dto.activity_category_id,
    );

    this.validateEntry(dto, category);
    await this.assertKpiLink(
      report.companyId,
      report.employeeId,
      dto.employee_kpi_id,
    );

    const existingByRequest =
      dto.client_request_id &&
      (await this.entryRepository.findOne({
        where: {
          companyId: report.companyId,
          dailyActivityReportId: report.id,
          clientRequestId: dto.client_request_id,
        },
      }));

    if (existingByRequest) {
      return this.getReportResponse(report);
    }

    await this.entryRepository.save(
      this.entryRepository.create({
        companyId: report.companyId,
        dailyActivityReportId: report.id,
        activityCategoryId: dto.activity_category_id,
        kpiDefinitionId: dto.kpi_definition_id ?? null,
        employeeKpiId: dto.employee_kpi_id ?? null,
        projectReference: dto.project_reference?.trim() ?? null,
        taskReference: dto.task_reference?.trim() ?? null,
        fieldPartyId: dto.field_party_id ?? null,
        externalReferenceType: dto.external_reference_type?.trim() ?? null,
        externalReferenceId: dto.external_reference_id?.trim() ?? null,
        title: dto.title.trim(),
        description: dto.description.trim(),
        expectedResult: dto.expected_result?.trim() ?? null,
        dueDate: dto.due_date ? new Date(dto.due_date) : null,
        completionDate:
          dto.status === DailyActivityStatusEnum.COMPLETED ? new Date() : null,
        plannedStartTime: dto.planned_start_time
          ? new Date(dto.planned_start_time)
          : new Date(`${report.activityDate}T09:00:00.000Z`),
        plannedEndTime: dto.planned_end_time
          ? new Date(dto.planned_end_time)
          : null,
        actualStartTime: dto.actual_start_time
          ? new Date(dto.actual_start_time)
          : null,
        actualEndTime: dto.actual_end_time
          ? new Date(dto.actual_end_time)
          : null,
        status: dto.status ?? DailyActivityStatusEnum.PLANNED,
        origin: DailyActivityOriginEnum.SELF_CREATED,
        reviewStatus: DailyActivityEntryReviewStatusEnum.NOT_REQUIRED,
        reviewedAt: null,
        reviewedByCompanyUserId: null,
        outcome: dto.outcome?.trim() ?? null,
        remarks: dto.remarks?.trim() ?? null,
        deferReason: dto.defer_reason?.trim() ?? null,
        followUpDate: dto.follow_up_date ?? null,
        completionPercentage: String(dto.completion_percentage ?? 0),
        managerComment: null,
        managerValidated: false,
        priority: dto.priority ?? DailyActivityPriorityEnum.MEDIUM,
        assignedByCompanyUserId: null,
        assignedByEmployeeId: null,
        assignedBySnapshot: null,
        checklist: (dto.checklist ?? []).map((item) => ({
          id: item.id,
          title: item.title.trim(),
          completed: item.completed === true,
        })),
        linkedFieldVisitId: null,
        clientRequestId: dto.client_request_id ?? null,
      }),
    );

    return this.getReportResponse(report);
  }

  async updateMyEntry(
    actor: AuthenticatedUser,
    reportId: number,
    entryId: number,
    dto: UpdateDailyActivityEntryDto,
  ) {
    const report = await this.lockMyEditableReport(actor, reportId);
    const entry = await this.entryRepository.findOne({
      where: {
        id: entryId,
        companyId: report.companyId,
        dailyActivityReportId: report.id,
      },
    });

    if (!entry) {
      throw new NotFoundException('Daily activity entry not found.');
    }
    const previousStatus = entry.status;

    const previousChecklist = Array.isArray(entry.checklist)
      ? entry.checklist.map((item) => ({ ...item }))
      : [];

    const category = await this.policyService.getCategoryOrFail(
      report.companyId,
      dto.activity_category_id ?? entry.activityCategoryId,
    );

    const merged = {
      ...entry,
      ...{
        activity_category_id:
          dto.activity_category_id ?? entry.activityCategoryId,
        planned_start_time:
          dto.planned_start_time ?? entry.plannedStartTime?.toISOString(),
        planned_end_time:
          dto.planned_end_time ?? entry.plannedEndTime?.toISOString(),
        status: dto.status ?? entry.status,
        outcome: dto.outcome ?? entry.outcome,
        defer_reason: dto.defer_reason ?? entry.deferReason,
        title: dto.title ?? entry.title,
        description: dto.description ?? entry.description,
        due_date: dto.due_date ?? entry.dueDate?.toISOString(),
        actual_start_time:
          dto.actual_start_time ?? entry.actualStartTime?.toISOString(),
        actual_end_time:
          dto.actual_end_time ?? entry.actualEndTime?.toISOString(),
        checklist: dto.checklist ?? entry.checklist,
        completion_percentage:
          dto.completion_percentage ?? Number(entry.completionPercentage),
      },
    } as unknown as CreateDailyActivityEntryDto;

    this.validateEntry(merged, category);
    assertDateRange(
      report.activityDate,
      merged.due_date?.slice(0, 10),
      'Activity',
    );
    if (dto.employee_kpi_id !== undefined) {
      await this.assertKpiLink(
        report.companyId,
        report.employeeId,
        dto.employee_kpi_id,
      );
    }

    if (dto.activity_category_id !== undefined) {
      entry.activityCategoryId = dto.activity_category_id;
    }
    if (dto.kpi_definition_id !== undefined) {
      entry.kpiDefinitionId = dto.kpi_definition_id ?? null;
    }
    if (dto.employee_kpi_id !== undefined) {
      entry.employeeKpiId = dto.employee_kpi_id ?? null;
    }
    if (dto.project_reference !== undefined) {
      entry.projectReference = dto.project_reference?.trim() ?? null;
    }
    if (dto.task_reference !== undefined) {
      entry.taskReference = dto.task_reference?.trim() ?? null;
    }
    if (dto.field_party_id !== undefined) {
      entry.fieldPartyId = dto.field_party_id ?? null;
    }
    if (dto.external_reference_type !== undefined) {
      entry.externalReferenceType = dto.external_reference_type?.trim() ?? null;
    }
    if (dto.external_reference_id !== undefined) {
      entry.externalReferenceId = dto.external_reference_id?.trim() ?? null;
    }
    if (dto.title !== undefined) {
      entry.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      entry.description = dto.description.trim();
    }
    if (dto.expected_result !== undefined) {
      entry.expectedResult = dto.expected_result?.trim() ?? null;
    }
    if (dto.due_date !== undefined) {
      entry.dueDate = dto.due_date ? new Date(dto.due_date) : null;
    }
    if (dto.planned_start_time !== undefined) {
      entry.plannedStartTime = dto.planned_start_time
        ? new Date(dto.planned_start_time)
        : null;
    }
    if (dto.planned_end_time !== undefined) {
      entry.plannedEndTime = dto.planned_end_time
        ? new Date(dto.planned_end_time)
        : null;
    }
    if (dto.actual_start_time !== undefined) {
      entry.actualStartTime = dto.actual_start_time
        ? new Date(dto.actual_start_time)
        : null;
    }
    if (dto.actual_end_time !== undefined) {
      entry.actualEndTime = dto.actual_end_time
        ? new Date(dto.actual_end_time)
        : null;
    }
    if (dto.status !== undefined) {
      entry.status = dto.status;
      if (dto.status === DailyActivityStatusEnum.COMPLETED) {
        entry.completionDate ??= new Date();
      } else {
        entry.completionDate = null;
        entry.reviewStatus = DailyActivityEntryReviewStatusEnum.NOT_REQUIRED;
        entry.managerValidated = false;
      }
    }
    if (dto.outcome !== undefined) {
      entry.outcome = dto.outcome?.trim() ?? null;
    }
    if (dto.remarks !== undefined) {
      entry.remarks = dto.remarks?.trim() ?? null;
    }
    if (dto.defer_reason !== undefined) {
      entry.deferReason = dto.defer_reason?.trim() ?? null;
    }
    if (dto.follow_up_date !== undefined) {
      entry.followUpDate = dto.follow_up_date ?? null;
    }
    if (dto.completion_percentage !== undefined) {
      entry.completionPercentage = String(dto.completion_percentage);
    }
    if (dto.priority !== undefined) {
      entry.priority = dto.priority;
    }
    if (dto.checklist !== undefined) {
      entry.checklist = dto.checklist.map((item) => ({
        id: item.id,
        title: item.title.trim(),
        completed: item.completed === true,
      }));
    }

    await this.entryRepository.save(entry);

    if (
      previousStatus !== DailyActivityStatusEnum.COMPLETED &&
      entry.status === DailyActivityStatusEnum.COMPLETED
    ) {
      await this.auditService.log({
        action: 'DAILY_ACTIVITY_COMPLETED',
        actor,
        employeeId: report.employeeId,
        entityType: 'DAILY_ACTIVITY_ENTRY',
        entityId: entry.id,
        beforeValues: { status: previousStatus },
        afterValues: {
          status: entry.status,
          completion_date: entry.completionDate,
          outcome: entry.outcome,
        },
      });
    }

    if (
      dto.checklist !== undefined &&
      entry.taskReference === 'MANAGER_ASSIGNED' &&
      JSON.stringify(previousChecklist) !== JSON.stringify(entry.checklist)
    ) {
      await this.notifyManagerOfChecklistUpdate(actor, report, entry);
    }

    return this.getReportResponse(report);
  }

  async updateManagerEntrySchedule(
    actor: AuthenticatedUser,
    entryId: number,
    dto: UpdateDailyActivityEntryDto,
  ) {
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, companyId: this.getCompanyId(actor) },
    });
    if (!entry) {
      throw new NotFoundException('Daily activity entry not found.');
    }

    const report = await this.getManagerAccessibleReport(
      actor,
      entry.dailyActivityReportId,
    );
    await this.ensureEditableReport(report);
    if (
      !this.isManagerAssignedTaskRow(
        entry as unknown as Record<string, unknown>,
      )
    ) {
      throw new ForbiddenException(
        'Only manager-assigned work can be rescheduled here.',
      );
    }

    const start = dto.planned_start_time
      ? new Date(dto.planned_start_time)
      : entry.plannedStartTime;
    const end = dto.planned_end_time
      ? new Date(dto.planned_end_time)
      : entry.plannedEndTime;
    if (
      !start ||
      !end ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new BadRequestException('Choose a valid start and end time.');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be later than start time.');
    }

    entry.plannedStartTime = start;
    entry.plannedEndTime = end;
    await this.entryRepository.save(entry);

    await this.auditService.log({
      action: 'DAILY_ACTIVITY_RESCHEDULED',
      actor,
      employeeId: report.employeeId,
      entityType: 'DAILY_ACTIVITY_ENTRY',
      entityId: entry.id,
      afterValues: {
        planned_start_time: start,
        planned_end_time: end,
      },
    });

    return this.getReportResponse(report);
  }

  private async notifyManagerOfChecklistUpdate(
    actor: AuthenticatedUser,
    report: DailyActivityReport,
    entry: DailyActivityEntry,
  ): Promise<void> {
    const receiverCompanyUserId = entry.assignedByCompanyUserId;
    if (!receiverCompanyUserId) return;

    const employeeSnapshot: Record<string, unknown> =
      report.employeeSnapshot ?? {};
    const employeeName = this.toText(employeeSnapshot.full_name, 'An employee');
    const checklist = Array.isArray(entry.checklist) ? entry.checklist : [];
    const completedCount = checklist.filter(
      (item) => item.completed === true,
    ).length;
    const checklistSummary = checklist.length
      ? `${completedCount}/${checklist.length} checklist items complete`
      : 'the checklist';

    try {
      await this.notificationsService.createAndPush({
        company_id: report.companyId,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: receiverCompanyUserId,
        type: NotificationTypeEnum.GENERAL,
        category: NotificationCategoryEnum.GENERAL,
        priority: NotificationPriorityEnum.MEDIUM,
        title: 'Task checklist updated',
        message: `${employeeName} updated the checklist for “${entry.title}” — ${checklistSummary}.`,
        related_module: 'activities',
        entity_type: 'DAILY_ACTIVITY_ENTRY',
        entity_id: entry.id,
        action_url: `/dashboard/activities/team?task=${entry.id}`,
        is_mandatory: true,
        metadata: {
          task_title: entry.title,
          employee_name: employeeName,
          task_id: entry.id,
          report_id: report.id,
          checklist,
          completed_count: completedCount,
          checklist_count: checklist.length,
        },
        channels: [NotificationChannelEnum.IN_APP],
        dedupe_key: `activities:task-checklist:${entry.id}:${entry.updatedAt?.getTime() ?? Date.now()}`,
      });
    } catch (error) {
      this.logger.warn(
        `Could not create in-app checklist notification for task ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async removeMyEntry(
    actor: AuthenticatedUser,
    reportId: number,
    entryId: number,
  ) {
    const report = await this.lockMyEditableReport(actor, reportId);
    const entry = await this.entryRepository.findOne({
      where: {
        id: entryId,
        companyId: report.companyId,
        dailyActivityReportId: report.id,
      },
    });

    if (!entry) {
      throw new NotFoundException('Daily activity entry not found.');
    }

    await this.evidenceRepository.delete({
      companyId: report.companyId,
      dailyActivityEntryId: entry.id,
    });
    await this.entryRepository.remove(entry);
    return this.getReportResponse(report);
  }

  async addMyEvidence(
    actor: AuthenticatedUser,
    entryId: number,
    dto: AddDailyActivityEvidenceDto,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, companyId },
    });

    if (!entry) {
      throw new NotFoundException('Daily activity entry not found.');
    }

    const report = await this.reportRepository.findOne({
      where: {
        id: entry.dailyActivityReportId,
        companyId,
        employeeId,
      },
    });

    if (!report) {
      throw new ForbiddenException('You cannot add evidence to this activity.');
    }

    await this.ensureEditableReport(report);

    const document = await this.dataSource.getRepository(Document).findOne({
      where: {
        id: dto.document_id,
        company_id: companyId,
        entity_type: DocumentEntityTypeEnum.EMPLOYEE,
        entity_id: employeeId,
      },
    });
    if (!document)
      throw new NotFoundException(
        'Choose an existing document from your own employee documents.',
      );

    await this.evidenceRepository.save(
      this.evidenceRepository.create({
        companyId,
        dailyActivityEntryId: entry.id,
        documentId: dto.document_id,
        description: dto.description?.trim() ?? null,
        submittedByCompanyUserId: actor.companyMembershipId ?? null,
      }),
    );

    return this.getReportResponse(report);
  }

  async addMyComment(
    actor: AuthenticatedUser,
    entryId: number,
    dto: CreateDailyActivityCommentDto,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, companyId },
    });
    if (!entry) throw new NotFoundException('Daily activity entry not found.');
    const report = await this.reportRepository.findOne({
      where: { id: entry.dailyActivityReportId, companyId, employeeId },
    });
    if (!report)
      throw new ForbiddenException('You cannot comment on this activity.');
    await this.commentRepository.save(
      this.commentRepository.create({
        companyId,
        dailyActivityEntryId: entry.id,
        authorCompanyUserId: actor.companyMembershipId ?? actor.id ?? null,
        authorEmployeeId: actor.employeeId ?? null,
        authorSnapshot: actor.employeeId
          ? await this.buildEmployeeSnapshot(
              await this.getEmployee(companyId, actor.employeeId),
            )
          : null,
        body: dto.body.trim(),
      }),
    );
    return this.getReportResponse(report);
  }

  async addManagerComment(
    actor: AuthenticatedUser,
    entryId: number,
    dto: CreateDailyActivityCommentDto,
  ) {
    const companyId = this.getCompanyId(actor);
    const entry = await this.entryRepository.findOne({
      where: { id: entryId, companyId },
    });
    if (!entry) throw new NotFoundException('Daily activity entry not found.');
    const report = await this.getManagerAccessibleReport(
      actor,
      entry.dailyActivityReportId,
    );
    await this.commentRepository.save(
      this.commentRepository.create({
        companyId,
        dailyActivityEntryId: entry.id,
        authorCompanyUserId: actor.companyMembershipId ?? actor.id ?? null,
        authorEmployeeId: actor.employeeId ?? null,
        authorSnapshot: actor.employeeId
          ? await this.buildEmployeeSnapshot(
              await this.getEmployee(companyId, actor.employeeId),
            )
          : null,
        body: dto.body.trim(),
      }),
    );
    return this.getReportResponse(report);
  }

  async submitMyDailyReport(
    actor: AuthenticatedUser,
    reportId: number,
    dto: SubmitDailyActivityReportDto,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);

    return this.dataSource.transaction(async (manager) => {
      const report = await manager.getRepository(DailyActivityReport).findOne({
        where: { id: reportId, companyId, employeeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!report) {
        throw new NotFoundException('Daily activity report not found.');
      }

      if (
        ![
          DailyActivityReportStatusEnum.DRAFT,
          DailyActivityReportStatusEnum.RETURNED_FOR_CORRECTION,
        ].includes(report.status)
      ) {
        throw new ConflictException(
          'The daily activity report cannot be submitted in its current status.',
        );
      }

      let entries = await manager.getRepository(DailyActivityEntry).find({
        where: { companyId, dailyActivityReportId: report.id },
      });

      if (dto.entry_ids !== undefined) {
        entries = await this.keepSelectedEntries(
          manager,
          report,
          entries,
          dto.entry_ids,
        );
      }

      const policy = report.policySnapshot;
      const minimumCount = Number(policy.minimum_activity_count ?? 1);
      const minimumCompleted = Number(
        policy.minimum_completed_activity_count ?? 1,
      );

      if (entries.length < minimumCount) {
        throw new BadRequestException(
          `At least ${minimumCount} activities are required.`,
        );
      }

      const completed = entries.filter(
        (entry) => entry.status === DailyActivityStatusEnum.COMPLETED,
      );

      if (completed.length < minimumCompleted) {
        throw new BadRequestException(
          `At least ${minimumCompleted} completed activities are required.`,
        );
      }

      await this.assertRequiredEvidence(companyId, entries);

      const attendance = await this.attendanceRepository.findOne({
        where: {
          companyId,
          employeeId,
          attendanceDate: report.activityDate,
        },
      });

      const now = new Date();
      const cutoff = this.resolveCutoff(
        report.activityDate,
        this.toText(
          policy.submission_cutoff_time,
          this.configService.get<string>(
            'ACTIVITY_DEFAULT_CUTOFF_TIME',
            '20:00',
          ),
        ),
      );
      const delayMinutes =
        now > cutoff
          ? Math.ceil((now.getTime() - cutoff.getTime()) / 60000)
          : 0;

      report.employeeSummary = dto.employee_summary.trim();
      report.overallRemarks = dto.overall_remarks?.trim() ?? null;
      report.attendanceSnapshot = attendance
        ? {
            attendance_date: attendance.attendanceDate,
            status: attendance.attendanceStatus,
            check_in_at: attendance.checkInAt,
            check_out_at: attendance.checkOutAt,
            work_minutes: attendance.workMinutes,
          }
        : null;
      report.submittedAt = now;
      report.submissionIsLate = delayMinutes > 0;
      report.submissionDelayMinutes = delayMinutes;
      report.status =
        policy.manager_review_required === false
          ? DailyActivityReportStatusEnum.APPROVED
          : DailyActivityReportStatusEnum.MANAGER_REVIEW_PENDING;
      report.clientRequestId = dto.client_request_id;

      for (const entry of completed) {
        entry.completionDate ??= now;
        entry.reviewStatus =
          policy.manager_review_required === false
            ? DailyActivityEntryReviewStatusEnum.NOT_REQUIRED
            : DailyActivityEntryReviewStatusEnum.PENDING;
      }
      await manager.getRepository(DailyActivityEntry).save(completed);

      const saved = await manager
        .getRepository(DailyActivityReport)
        .save(report);

      if (
        saved.status === DailyActivityReportStatusEnum.MANAGER_REVIEW_PENDING
      ) {
        await this.createManagerActionItem(saved);
      }

      const employee = await this.getEmployee(companyId, employeeId);
      if (
        saved.status === DailyActivityReportStatusEnum.MANAGER_REVIEW_PENDING
      ) {
        void this.notifyManagerActivityCompleted(saved, employee, actor);
      }
      await this.exceptionService.reconcileForEmployeeDate(
        employee,
        saved.activityDate,
        {
          dailySubmissionRequired: true,
          fieldVisitPlanRequired: Boolean(
            saved.policySnapshot.field_visit_plan_required,
          ),
        },
      );

      await this.auditService.log(
        {
          action: 'DAILY_ACTIVITY_REPORT_SUBMITTED',
          actor,
          employeeId,
          entityType: 'DAILY_ACTIVITY_REPORT',
          entityId: saved.id,
          afterValues: {
            status: saved.status,
            submission_is_late: saved.submissionIsLate,
            submission_delay_minutes: saved.submissionDelayMinutes,
          },
        },
        manager,
      );

      return this.getReportResponse(saved, manager);
    });
  }

  async listPendingReviews(
    actor: AuthenticatedUser,
    query: WorkActivityQueryDto,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeIds =
      await this.hrAccessService.getAccessibleEmployeeIds(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    if (employeeIds !== null && employeeIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, total_pages: 0 } };
    }

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .where('report.companyId = :companyId', { companyId })
      .andWhere('report.status = :status', {
        status: DailyActivityReportStatusEnum.MANAGER_REVIEW_PENDING,
      })
      .orderBy('report.submittedAt', 'ASC', 'NULLS LAST')
      .addOrderBy('report.activityDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (employeeIds !== null) {
      qb.andWhere('report.employeeId IN (:...employeeIds)', { employeeIds });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: await Promise.all(
        items.map((item) => this.getReportResponse(item)),
      ),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  private async listScoped(
    actor: AuthenticatedUser,
    query: WorkActivityQueryDto,
    allowCompanyScope: boolean,
  ) {
    const companyId = this.getCompanyId(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const employeeIds =
      await this.hrAccessService.getAccessibleEmployeeIds(actor);

    if (
      !allowCompanyScope &&
      employeeIds !== null &&
      employeeIds.length === 0
    ) {
      return { data: [], meta: { page, limit, total: 0, total_pages: 0 } };
    }

    const qb = this.reportRepository
      .createQueryBuilder('report')
      .where('report.companyId = :companyId', { companyId })
      .orderBy('report.activityDate', 'DESC')
      .addOrderBy('report.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (employeeIds !== null) {
      if (employeeIds.length === 0) {
        return { data: [], meta: { page, limit, total: 0, total_pages: 0 } };
      }
      qb.andWhere('report.employeeId IN (:...employeeIds)', { employeeIds });
    }

    if (query.employee_id) {
      qb.andWhere('report.employeeId = :employeeId', {
        employeeId: query.employee_id,
      });
    }
    if (query.date_from) {
      qb.andWhere('report.activityDate >= :dateFrom', {
        dateFrom: query.date_from,
      });
    }
    if (query.date_to) {
      qb.andWhere('report.activityDate <= :dateTo', { dateTo: query.date_to });
    }
    if (query.status) {
      qb.andWhere('report.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: await Promise.all(
        items.map((item) => this.getReportResponse(item)),
      ),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async getForManager(actor: AuthenticatedUser, id: number) {
    const report = await this.getManagerAccessibleReport(actor, id);
    return this.getReportResponse(report);
  }

  private async assertKpiLink(
    companyId: number,
    employeeId: number,
    employeeKpiId?: number,
  ): Promise<void> {
    if (employeeKpiId === undefined) return;
    const kpi = await this.employeeKpiRepository.findOne({
      where: {
        id: employeeKpiId,
        companyId,
        employeeId,
        status: EmployeeKpiStatusEnum.APPROVED,
      },
      relations: { performancePeriod: true },
    });
    if (!kpi) {
      throw new BadRequestException(
        'Activities can only be linked to an approved KPI owned by the assignee.',
      );
    }
    if (
      [
        PerformancePeriodStatusEnum.LOCKED,
        PerformancePeriodStatusEnum.CANCELLED,
      ].includes(kpi.performancePeriod.status)
    ) {
      throw new ConflictException('The KPI performance period is closed.');
    }
  }

  async reviewDailyActivity(
    actor: AuthenticatedUser,
    reportId: number,
    dto: ReviewDailyActivityReportDto,
  ) {
    if (!dto.comments?.trim())
      throw new BadRequestException(
        'Explain the activity review decision before submitting.',
      );
    if (
      dto.rating !== undefined &&
      (!Number.isFinite(Number(dto.rating)) ||
        Number(dto.rating) < 0 ||
        Number(dto.rating) > 100)
    )
      throw new BadRequestException(
        'Activity review rating must be between 0 and 100.',
      );
    return this.dataSource.transaction(async (manager) => {
      const report = await manager.getRepository(DailyActivityReport).findOne({
        where: { id: reportId, companyId: this.getCompanyId(actor) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!report) {
        throw new NotFoundException('Daily activity report not found.');
      }

      await this.assertManagerCanReview(
        actor,
        report.employeeId,
        report.managerEmployeeId,
      );

      if (
        report.status !== DailyActivityReportStatusEnum.MANAGER_REVIEW_PENDING
      ) {
        throw new ConflictException(
          'The report is not awaiting manager review.',
        );
      }

      for (const entryReview of dto.entry_reviews ?? []) {
        const entry = await manager.getRepository(DailyActivityEntry).findOne({
          where: {
            id: entryReview.entry_id,
            companyId: report.companyId,
            dailyActivityReportId: report.id,
          },
        });
        if (!entry) continue;
        entry.managerComment = entryReview.manager_comment?.trim() ?? null;
        if (entryReview.manager_validated !== undefined) {
          entry.managerValidated = entryReview.manager_validated;
        }
        await manager.getRepository(DailyActivityEntry).save(entry);
      }

      report.managerComments = dto.comments.trim();
      report.managerRating = dto.rating ?? null;
      report.reviewedAt = new Date();
      report.reviewedByCompanyUserId = actor.companyMembershipId ?? null;

      switch (dto.decision) {
        case DailyActivityReviewDecisionEnum.APPROVE:
          report.status = DailyActivityReportStatusEnum.APPROVED;
          break;
        case DailyActivityReviewDecisionEnum.RETURN:
          report.status = DailyActivityReportStatusEnum.RETURNED_FOR_CORRECTION;
          break;
        case DailyActivityReviewDecisionEnum.REJECT:
          report.status = DailyActivityReportStatusEnum.REJECTED;
          break;
      }

      const reportEntries = await manager
        .getRepository(DailyActivityEntry)
        .find({
          where: {
            companyId: report.companyId,
            dailyActivityReportId: report.id,
          },
        });
      for (const entry of reportEntries) {
        if (entry.status !== DailyActivityStatusEnum.COMPLETED) continue;
        entry.reviewedAt = report.reviewedAt;
        entry.reviewedByCompanyUserId = actor.companyMembershipId ?? null;
        switch (dto.decision) {
          case DailyActivityReviewDecisionEnum.APPROVE:
            entry.reviewStatus = DailyActivityEntryReviewStatusEnum.APPROVED;
            entry.managerValidated = true;
            break;
          case DailyActivityReviewDecisionEnum.RETURN:
            entry.reviewStatus = DailyActivityEntryReviewStatusEnum.RETURNED;
            entry.managerValidated = false;
            break;
          case DailyActivityReviewDecisionEnum.REJECT:
            entry.reviewStatus = DailyActivityEntryReviewStatusEnum.REJECTED;
            entry.managerValidated = false;
            break;
        }
      }
      await manager.getRepository(DailyActivityEntry).save(reportEntries);

      const saved = await manager
        .getRepository(DailyActivityReport)
        .save(report);
      await this.actionItemsService.completeAllOpenForEntity(
        saved.companyId,
        'WORK_ACTIVITIES',
        'DAILY_ACTIVITY_REPORT',
        saved.id,
      );

      const employee = await this.getEmployee(
        saved.companyId,
        saved.employeeId,
      );
      await this.exceptionService.reconcileForEmployeeDate(
        employee,
        saved.activityDate,
        {
          dailySubmissionRequired: true,
          fieldVisitPlanRequired: Boolean(
            saved.policySnapshot.field_visit_plan_required,
          ),
        },
      );

      await this.auditService.log(
        {
          action: 'DAILY_ACTIVITY_REPORT_REVIEWED',
          actor,
          employeeId: saved.employeeId,
          entityType: 'DAILY_ACTIVITY_REPORT',
          entityId: saved.id,
          afterValues: {
            status: saved.status,
            manager_comments: saved.managerComments,
          },
        },
        manager,
      );

      void this.notifyEmployeeActivityReviewed(saved, employee, actor);

      return this.getReportResponse(saved, manager);
    });
  }

  private async getManagerAccessibleReport(
    actor: AuthenticatedUser,
    id: number,
  ) {
    const report = await this.reportRepository.findOne({
      where: { id, companyId: this.getCompanyId(actor) },
    });

    if (!report) {
      throw new NotFoundException('Daily activity report not found.');
    }

    await this.assertManagerCanReview(
      actor,
      report.employeeId,
      report.managerEmployeeId,
    );
    return report;
  }

  private async assertManagerCanAssign(
    actor: AuthenticatedUser,
    employee: Employee,
  ) {
    if (employee.company_id !== this.getCompanyId(actor)) {
      throw new ForbiddenException(
        'You can only assign work to employees in your company.',
      );
    }
    if (employee.employment_status !== EmploymentStatusEnum.ACTIVE) {
      throw new BadRequestException(
        'Only active employees can be assigned work.',
      );
    }

    const accessibleEmployeeIds =
      await this.hrAccessService.getAccessibleEmployeeIds(actor);
    if (
      accessibleEmployeeIds !== null &&
      !accessibleEmployeeIds.includes(employee.id)
    ) {
      throw new ForbiddenException(
        'You can only assign work within your reporting scope.',
      );
    }
  }

  private async assertManagerCanReview(
    actor: AuthenticatedUser,
    employeeId: number,
    managerEmployeeId: number | null,
  ) {
    if (
      actor.employeeId &&
      managerEmployeeId &&
      actor.employeeId === managerEmployeeId
    ) {
      return;
    }

    const accessibleEmployeeIds =
      await this.hrAccessService.getAccessibleEmployeeIds(actor);
    if (
      accessibleEmployeeIds === null ||
      accessibleEmployeeIds.includes(employeeId)
    ) {
      return;
    }

    throw new ForbiddenException('You are not allowed to review this report.');
  }

  private async lockMyEditableReport(
    actor: AuthenticatedUser,
    reportId: number,
  ) {
    const companyId = this.getCompanyId(actor);
    const employeeId = this.getEmployeeId(actor);
    const report = await this.reportRepository.findOne({
      where: { id: reportId, companyId, employeeId },
    });

    if (!report) {
      throw new NotFoundException('Daily activity report not found.');
    }

    await this.ensureEditableReport(report);
    return report;
  }

  private ensureEditableReport(report: DailyActivityReport): Promise<void> {
    if (
      ![
        DailyActivityReportStatusEnum.DRAFT,
        DailyActivityReportStatusEnum.RETURNED_FOR_CORRECTION,
      ].includes(report.status)
    ) {
      throw new ConflictException(
        'Only draft or returned reports can be edited.',
      );
    }

    return Promise.resolve();
  }

  private validateEntry(
    entry: CreateDailyActivityEntryDto,
    category: ActivityCategory,
  ) {
    if (
      category.requiresTime &&
      (!entry.planned_start_time || !entry.planned_end_time)
    ) {
      throw new BadRequestException(
        'Start time and end time are required for this activity category.',
      );
    }

    if (!entry.title?.trim() || !entry.description?.trim()) {
      throw new BadRequestException(
        'Activity title and description cannot be blank.',
      );
    }
    for (const [start, end, label] of [
      [entry.planned_start_time, entry.planned_end_time, 'Planned'],
      [entry.actual_start_time, entry.actual_end_time, 'Actual'],
    ] as const) {
      if (end && !start)
        throw new BadRequestException(
          `${label} end time requires a start time.`,
        );
      if (
        (start && Number.isNaN(Date.parse(start))) ||
        (end && Number.isNaN(Date.parse(end)))
      ) {
        throw new BadRequestException(
          `${label} activity times must be valid timestamps.`,
        );
      }
      if (start && end && Date.parse(end) <= Date.parse(start)) {
        throw new BadRequestException(
          `${label} end time must be later than start time.`,
        );
      }
    }
    if (
      entry.completion_percentage !== undefined &&
      (!Number.isFinite(entry.completion_percentage) ||
        entry.completion_percentage < 0 ||
        entry.completion_percentage > 100)
    ) {
      throw new BadRequestException(
        'Activity completion percentage must be between 0 and 100.',
      );
    }
    if (entry.checklist) {
      if (
        entry.checklist.length > 100 ||
        entry.checklist.some(
          (item) =>
            !item.id?.trim() || !item.title?.trim() || item.title.length > 250,
        )
      ) {
        throw new BadRequestException(
          'A checklist can have at most 100 items, each with a nonblank ID and title of at most 250 characters.',
        );
      }
      assertUniqueValues(
        entry.checklist.map((item) => item.id),
        'Activity checklist IDs',
      );
    }

    if (
      (entry.status ?? DailyActivityStatusEnum.PLANNED) ===
        DailyActivityStatusEnum.COMPLETED &&
      category.requiresOutcome &&
      !entry.outcome?.trim()
    ) {
      throw new BadRequestException(
        'An outcome is required for a completed activity.',
      );
    }

    if (
      (entry.status ?? DailyActivityStatusEnum.PLANNED) ===
        DailyActivityStatusEnum.DEFERRED &&
      !entry.defer_reason?.trim()
    ) {
      throw new BadRequestException('A defer reason is required.');
    }
  }

  private async assertRequiredEvidence(
    companyId: number,
    entries: DailyActivityEntry[],
  ) {
    const categoryIds = [
      ...new Set(entries.map((entry) => entry.activityCategoryId)),
    ];
    const categories = await this.categoryRepository.find({
      where: categoryIds.map((id) => ({ companyId, id })),
    });
    const categoryMap = new Map(
      categories.map((category) => [category.id, category]),
    );

    for (const entry of entries) {
      const category = categoryMap.get(entry.activityCategoryId);
      if (!category?.requiresEvidence) {
        continue;
      }

      const evidenceCount = await this.evidenceRepository.count({
        where: { companyId, dailyActivityEntryId: entry.id },
      });
      if (evidenceCount === 0) {
        throw new BadRequestException(
          `Evidence is required for activity '${entry.title}'.`,
        );
      }
    }
  }

  private resolveCutoff(activityDate: string, cutoffTime: string) {
    return new Date(`${activityDate}T${cutoffTime}:00.000Z`);
  }

  private async employeePhotoUrl(employee: Employee) {
    const resolved =
      await this.defaultAvatarsService.resolveEmployeeProfileAvatar(
        employee.company_id,
        employee,
      );
    return resolved.profile_photo_url;
  }

  private async buildEmployeeSnapshot(employee: Employee) {
    return {
      employee_id: employee.id,
      employee_no: employee.employee_no,
      full_name: [employee.first_name, employee.middle_name, employee.last_name]
        .filter(Boolean)
        .join(' '),
      profile_photo_url: await this.employeePhotoUrl(employee),
      branch_id: employee.primary_branch_id,
      department_id: employee.primary_department_id,
      position_id: employee.primary_position_id,
      grade_id: employee.grade_id,
      employment_type: employee.employment_type,
    };
  }

  private async resolveManagerCompanyUserId(managerEmployeeId: number | null) {
    if (!managerEmployeeId) {
      return null;
    }

    const manager = await this.employeeRepository.findOne({
      where: { id: managerEmployeeId },
      select: ['id', 'company_user_id'],
    });

    return manager?.company_user_id ?? null;
  }

  private normalizePolicySnapshot(policy: Record<string, unknown> | object) {
    const policyRecord = policy as Record<string, unknown>;
    return {
      minimum_activity_count: Number(policyRecord.minimumActivityCount ?? 1),
      minimum_completed_activity_count: Number(
        policyRecord.minimumCompletedActivityCount ?? 1,
      ),
      manager_review_required: policyRecord.managerReviewRequired !== false,
      submission_cutoff_time: this.toText(
        policyRecord.submissionCutoffTime,
        '20:00',
      ),
      daily_submission_required: policyRecord.dailySubmissionRequired !== false,
      field_visit_plan_required: Boolean(
        policyRecord.fieldVisitPlanRequired ?? false,
      ),
      allow_unplanned_visits: policyRecord.allowUnplannedVisits !== false,
      require_visit_selfie: Boolean(policyRecord.requireVisitSelfie ?? false),
      require_device_binding: policyRecord.requireDeviceBinding !== false,
      maximum_backdate_days: Number(policyRecord.maximumBackdateDays ?? 0),
    };
  }

  private async createManagerActionItem(report: DailyActivityReport) {
    if (!report.managerCompanyUserId) {
      return;
    }

    await this.actionItemsService.upsertOpen({
      companyId: report.companyId,
      assigneeCompanyUserId: report.managerCompanyUserId,
      assigneeEmployeeId: report.managerEmployeeId ?? null,
      actionType: ActionItemTypeEnum.APPROVAL,
      sourceModule: 'WORK_ACTIVITIES',
      sourceEntityType: 'DAILY_ACTIVITY_REPORT',
      sourceEntityId: report.id,
      sourceKey: `daily-activity-review:${report.id}`,
      title: 'Review daily activity report',
      description: `Daily activity report for ${report.activityDate} is awaiting review.`,
      actionUrl: `/manager/activities/reports/${report.id}`,
      metadata: {
        employee_id: report.employeeId,
        activity_date: report.activityDate,
      },
    });
  }

  private async notifyManagerActivityCompleted(
    report: DailyActivityReport,
    employee: Employee,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (!report.managerCompanyUserId) return;
    try {
      await this.notificationsService.createAndPush({
        company_id: report.companyId,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: report.managerCompanyUserId,
        category: NotificationCategoryEnum.HR,
        priority: NotificationPriorityEnum.MEDIUM,
        title: 'Activities awaiting review',
        message: `${employee.first_name} ${employee.last_name} submitted activities for ${report.activityDate}.`,
        related_module: 'WORK_ACTIVITIES',
        entity_type: 'DAILY_ACTIVITY_REPORT',
        entity_id: report.id,
        action_url: `/dashboard/activities/reviews?report=${report.id}`,
        dedupe_key: `daily-activity-submitted:${report.id}:${report.version}`,
      });
    } catch (error) {
      this.logger.warn(
        `Activity report ${report.id} was submitted, but notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyEmployeeActivityReviewed(
    report: DailyActivityReport,
    employee: Employee,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (!employee.company_user_id) return;
    try {
      await this.notificationsService.createAndPush({
        company_id: report.companyId,
        sender_company_user_id: actor.companyMembershipId ?? null,
        receiver_company_user_id: employee.company_user_id,
        category: NotificationCategoryEnum.HR,
        priority:
          report.status === DailyActivityReportStatusEnum.APPROVED
            ? NotificationPriorityEnum.MEDIUM
            : NotificationPriorityEnum.HIGH,
        title: `Activity report ${report.status.toLowerCase().replaceAll('_', ' ')}`,
        message:
          report.managerComments ??
          `Your activities for ${report.activityDate} were reviewed.`,
        related_module: 'WORK_ACTIVITIES',
        entity_type: 'DAILY_ACTIVITY_REPORT',
        entity_id: report.id,
        action_url: `/dashboard/me/activities/reports?report=${report.id}`,
        dedupe_key: `daily-activity-reviewed:${report.id}:${report.version}`,
      });
    } catch (error) {
      this.logger.warn(
        `Activity report ${report.id} was reviewed, but notification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getReportResponse(
    report: DailyActivityReport,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const entryRepository = manager.getRepository(DailyActivityEntry);
    const evidenceRepository = manager.getRepository(DailyActivityEvidence);
    const commentRepository = manager.getRepository(DailyActivityComment);

    const entries = await entryRepository.find({
      where: { companyId: report.companyId, dailyActivityReportId: report.id },
      order: { id: 'ASC' },
    });

    const evidence = entries.length
      ? await evidenceRepository.find({
          where: entries.map((entry) => ({
            companyId: report.companyId,
            dailyActivityEntryId: entry.id,
          })),
        })
      : [];

    const evidenceByEntryId = new Map<number, DailyActivityEvidence[]>();
    for (const item of evidence) {
      const bucket = evidenceByEntryId.get(item.dailyActivityEntryId) ?? [];
      bucket.push(item);
      evidenceByEntryId.set(item.dailyActivityEntryId, bucket);
    }

    const comments = entries.length
      ? await commentRepository.find({
          where: entries.map((entry) => ({
            companyId: report.companyId,
            dailyActivityEntryId: entry.id,
          })),
          order: { createdAt: 'ASC' },
        })
      : [];
    const commentsByEntryId = new Map<number, DailyActivityComment[]>();
    for (const item of comments) {
      const bucket = commentsByEntryId.get(item.dailyActivityEntryId) ?? [];
      bucket.push(item);
      commentsByEntryId.set(item.dailyActivityEntryId, bucket);
    }

    return {
      ...report,
      entries: entries.map((entry) => ({
        ...entry,
        evidence: evidenceByEntryId.get(entry.id) ?? [],
        comments: commentsByEntryId.get(entry.id) ?? [],
      })),
    };
  }
}
```

## /home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.ts

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';

const UNIQUE_MESSAGES: Readonly<Record<string, string>> = {
  UQ_daily_activity_employee_date:
    'A daily activity report already exists for this employee and date. Refresh and continue the existing draft.',
  UQ_activity_category_company_code:
    'An activity category already uses this code. Choose another code or edit the existing category.',
  UQ_performance_financial_year_company_code:
    'A performance financial year already uses this code.',
  UQ_performance_period_year_type_sequence:
    'This year already contains a period with this type and sequence number.',
  UQ_employee_performance_plan_year:
    'A performance plan with this employee, year, and version already exists. Refresh the existing plan.',
  UQ_performance_review_period_employee:
    'A review already exists for this employee and period. Refresh and continue that review.',
  UQ_performance_period_assignment_employee:
    'This employee is already assigned to the selected period.',
  UQ_kpi_definition_company_code: 'A KPI definition already uses this code.',
  UQ_kpi_definition_version:
    'Another request created this KPI version. Refresh the definition before creating the next version.',
  UQ_kpi_template_company_code: 'A KPI template already uses this code.',
  UQ_competency_template_company_code:
    'A competency template already uses this code.',
  UQ_performance_rating_scale_company_code:
    'A rating scale already uses this code.',
  UQ_performance_scorecard_company_code:
    'A scorecard already uses this code. The existing default remains available.',
  UQ_performance_workflow_company_code:
    'A review workflow already uses this code.',
  UQ_performance_feedback_360_review_rater:
    'This employee has already been invited to provide feedback for this review.',
  UQ_employee_kpi_cycle_review_kind:
    'This KPI already has a review for this cycle stage. Refresh the existing review.',
};

@Catch(QueryFailedError)
export class WorkflowDatabaseExceptionFilter implements ExceptionFilter<QueryFailedError> {
  private readonly logger = new Logger(WorkflowDatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const driver: unknown = exception.driverError;
    const record =
      driver && typeof driver === 'object'
        ? (driver as Record<string, unknown>)
        : {};
    const code = typeof record.code === 'string' ? record.code : '';
    const constraint =
      typeof record.constraint === 'string' ? record.constraint : '';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message =
      'The workflow could not be saved. Please retry; if the problem continues, contact your administrator.';
    if (code === '23505') {
      status = HttpStatus.CONFLICT;
      message =
        UNIQUE_MESSAGES[constraint] ??
        'A record with these unique workflow values already exists. Refresh before retrying or choose different values.';
    } else if (code === '23503') {
      status = HttpStatus.BAD_REQUEST;
      message =
        'A referenced employee, cycle, KPI, or configuration is no longer available. Refresh and select an existing record.';
    } else if (['23514', '23502', '22003', '22P02'].includes(code)) {
      status = HttpStatus.BAD_REQUEST;
      message =
        'The supplied workflow values violate a required field or numeric constraint. Check the highlighted dates, identifiers, and scores.';
    } else if (['40001', '40P01'].includes(code)) {
      status = HttpStatus.CONFLICT;
      message =
        'Another request changed this workflow at the same time. Refresh and retry the step.';
    } else {
      // Never include SQL parameters or database details in client responses or logs.
      this.logger.error(
        `Unexpected workflow database failure (code: ${code || 'unknown'}).`,
      );
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        error:
          status === HttpStatus.CONFLICT
            ? 'Conflict'
            : status === HttpStatus.BAD_REQUEST
              ? 'Bad Request'
              : 'Internal Server Error',
        message,
      });
  }
}
```

## /home/innocent/systems/hrms_backend/src/common/filters/workflow-database-exception.filter.spec.ts

```typescript
import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { WorkflowDatabaseExceptionFilter } from './workflow-database-exception.filter';

describe('workflow database exception boundary', () => {
  it.each([
    [
      '23505',
      'UQ_daily_activity_employee_date',
      409,
      'continue the existing draft',
    ],
    [
      '23505',
      'UQ_performance_period_year_type_sequence',
      409,
      'type and sequence',
    ],
    ['23503', 'fk_unknown', 400, 'no longer available'],
    ['40001', '', 409, 'changed this workflow'],
  ])(
    'maps %s into an actionable response without SQL detail',
    (code, constraint, statusCode, message) => {
      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const host = {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost;
      const driver = Object.assign(new Error('secret employee identifier'), {
        code,
        constraint,
        detail: 'secret parameter',
      });
      const failure = new QueryFailedError(
        'INSERT confidential SQL',
        ['secret'],
        driver,
      );
      new WorkflowDatabaseExceptionFilter().catch(failure, host);
      expect(response.status).toHaveBeenCalledWith(statusCode);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode,
          message: expect.stringContaining(message),
        }),
      );
      expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
      expect(JSON.stringify(response.json.mock.calls)).not.toContain(
        'confidential SQL',
      );
    },
  );
});
```

## /home/innocent/systems/hrms_backend/src/modules/hr/performance/services/performance-audit.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { getRequestAuditContext } from '../../../../common/request-context/request-context';
import { PerformanceAuditLog } from '../entities/performance-audit-log.entity';

type LogPerformanceAuditInput = {
  action: string;
  actor: AuthenticatedUser;
  employeeId?: number | null;
  performanceReviewId?: number | null;
  kpiAchievementId?: number | null;
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
  reason?: string | null;
};

@Injectable()
export class PerformanceAuditService {
  constructor(
    @InjectRepository(PerformanceAuditLog)
    private readonly auditRepository: Repository<PerformanceAuditLog>,
  ) {}

  async log(
    input: LogPerformanceAuditInput,
    manager?: EntityManager,
  ): Promise<void> {
    if (!input.actor.companyId) {
      return;
    }
    const context = getRequestAuditContext();

    const target =
      manager?.getRepository(PerformanceAuditLog) ?? this.auditRepository;
    await target.save(
      target.create({
        companyId: input.actor.companyId,
        action: input.action,
        actorCompanyUserId: input.actor.companyMembershipId ?? null,
        actorRoles: input.actor.roles ?? [],
        employeeId: input.employeeId ?? null,
        performanceReviewId: input.performanceReviewId ?? null,
        kpiAchievementId: input.kpiAchievementId ?? null,
        beforeValues: input.beforeValues ?? null,
        afterValues: input.afterValues ?? null,
        reason: input.reason ?? null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      }),
    );
  }
}
```

## /home/innocent/systems/hrms_backend/src/modules/hr/work-activities/services/work-activity-audit.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../../../common/interfaces/authenticated-user.interface';
import { WorkActivityAuditLog } from '../entities/analytics.entities';

type AuditInput = {
  action: string;
  actor?: AuthenticatedUser | null;
  companyId?: number | null;
  employeeId?: number | null;
  entityType?: string | null;
  entityId?: string | number | null;
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
  reason?: string | null;
};

@Injectable()
export class WorkActivityAuditService {
  constructor(
    @InjectRepository(WorkActivityAuditLog)
    private readonly repository: Repository<WorkActivityAuditLog>,
  ) {}

  async log(input: AuditInput, manager?: EntityManager): Promise<void> {
    const companyId = input.companyId ?? input.actor?.companyId ?? null;
    if (!companyId) {
      return;
    }

    const target =
      manager?.getRepository(WorkActivityAuditLog) ?? this.repository;
    await target.save(
      target.create({
        companyId,
        action: input.action,
        actorCompanyUserId: input.actor?.companyMembershipId ?? null,
        employeeId: input.employeeId ?? input.actor?.employeeId ?? null,
        entityType: input.entityType ?? null,
        entityId:
          input.entityId === undefined || input.entityId === null
            ? null
            : String(input.entityId),
        beforeValues: input.beforeValues ?? null,
        afterValues: input.afterValues ?? null,
        reason: input.reason ?? null,
      }),
    );
  }
}
```
