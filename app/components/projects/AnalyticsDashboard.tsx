import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Target, BarChart3, Zap, Users, CheckCircle2 } from 'lucide-react';
import type { Project, ChartDataPoint } from './types';

interface AnalyticsDashboardProps {
  projects: Project[];
  selectedProject?: Project | null;
  loading?: boolean;
}

export const AnalyticsDashboard = ({ projects, selectedProject, loading }: AnalyticsDashboardProps) => {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-bolt-elements-background-depth-3 rounded" />
          <div className="h-4 w-32 bg-bolt-elements-background-depth-3 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-bolt-elements-background-depth-2 rounded-xl p-6 border border-bolt-elements-borderColor"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-bolt-elements-background-depth-3" />
                <div className="w-14 h-4 bg-bolt-elements-background-depth-3 rounded" />
              </div>
              <div className="h-7 w-24 bg-bolt-elements-background-depth-3 rounded mb-2" />
              <div className="h-4 w-32 bg-bolt-elements-background-depth-3 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-bolt-elements-background-depth-2 rounded-xl p-6 border border-bolt-elements-borderColor h-56" />
          <div className="bg-bolt-elements-background-depth-2 rounded-xl p-6 border border-bolt-elements-borderColor h-56" />
        </div>
      </div>
    );
  }

  const analytics = useMemo(() => {
    const projectsToAnalyze = selectedProject ? [selectedProject] : projects;

    const totalFeatures = projectsToAnalyze.reduce((acc, project) => acc + (project.features?.length || 0), 0);

    const completedFeatures = projectsToAnalyze.reduce(
      (acc, project) => acc + (project.features?.filter((f) => f.status === 'completed').length || 0),
      0,
    );

    const inProgressFeatures = projectsToAnalyze.reduce(
      (acc, project) => acc + (project.features?.filter((f) => f.status === 'in-progress').length || 0),
      0,
    );

    const totalHoursTracked = projectsToAnalyze.reduce(
      (acc, project) => acc + (project.analytics?.totalHoursTracked || 0),
      0,
    );

    const averageCompletionTime =
      projectsToAnalyze.reduce((acc, project) => acc + (project.analytics?.averageFeatureCompletionTime || 0), 0) /
      (projectsToAnalyze.length || 1);

    const completionRate = totalFeatures > 0 ? (completedFeatures / totalFeatures) * 100 : 0;

    // Calculate velocity (features completed in last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentCompletions = projectsToAnalyze.reduce((acc, project) => {
      const recentFeatures =
        project.features?.filter((feature) => {
          const completedDate = feature.timeTracking.completedAt;
          return completedDate && new Date(completedDate) >= sevenDaysAgo;
        }).length || 0;
      return acc + recentFeatures;
    }, 0);

    return {
      totalFeatures,
      completedFeatures,
      inProgressFeatures,
      totalHoursTracked,
      averageCompletionTime,
      completionRate,
      recentCompletions,
      activeProjects: projectsToAnalyze.filter((p) => !p.archived).length,
      activeDevelopers: [
        ...new Set(
          projectsToAnalyze.flatMap((p) => p.features?.map((f) => f.analytics.assignee).filter(Boolean) || []),
        ),
      ].length,
    };
  }, [projects, selectedProject]);

  const velocityData: ChartDataPoint[] = useMemo(() => {
    // Generate last 7 days velocity data
    const data: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const projectsToAnalyze = selectedProject ? [selectedProject] : projects;
      const completions = projectsToAnalyze.reduce((acc, project) => {
        return (
          acc +
          (project.features?.filter((feature) => {
            const completedDate = feature.timeTracking.completedAt;
            return completedDate && new Date(completedDate) >= dayStart && new Date(completedDate) <= dayEnd;
          }).length || 0)
        );
      }, 0);

      data.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: completions,
        date: date.toISOString(),
      });
    }

    return data;
  }, [projects, selectedProject]);

  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    trend,
    color = 'blue',
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    trend?: number;
    color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  }) => {
    const IconComponent = icon;
    const colorClasses = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      purple: 'bg-purple-500',
      red: 'bg-red-500',
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 rounded-xl p-6 shadow-sm border border-bolt-elements-borderColor hover:shadow-lg transition-all duration-300"
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-lg ${colorClasses[color]}/20 flex items-center justify-center ring-1 ring-${color}-500/30`}
          >
            <IconComponent className={`w-6 h-6 text-${color}-500`} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <h3 className="text-2xl font-bold text-bolt-elements-textPrimary mb-1">{value}</h3>
        <p className="text-bolt-elements-textSecondary text-sm">{title}</p>
        {subtitle && <p className="text-bolt-elements-textTertiary text-xs mt-1">{subtitle}</p>}
      </motion.div>
    );
  };

  const SimpleChart = ({ data, title }: { data: ChartDataPoint[]; title: string }) => {
    const maxValue = Math.max(...data.map((d) => d.value), 1);

    return (
      <div className="bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 rounded-xl p-6 shadow-sm border border-bolt-elements-borderColor hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">{title}</h3>
        <div className="flex items-end justify-between h-32">
          {data.map((point, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className="w-full max-w-8 bg-bolt-elements-item-contentAccent rounded-t transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${(point.value / maxValue) * 100}%`,
                  minHeight: point.value > 0 ? '4px' : '1px',
                }}
                title={`${point.label}: ${point.value}`}
              />
              <span className="text-xs text-bolt-elements-textSecondary mt-2 transform -rotate-45">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary">
          {selectedProject ? `${selectedProject.name} Analytics` : 'Project Analytics'}
        </h2>
        <div className="text-sm text-bolt-elements-textSecondary">Last updated: {new Date().toLocaleDateString()}</div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Features"
          value={analytics.totalFeatures}
          subtitle={`${analytics.inProgressFeatures} in progress`}
          icon={Zap}
          color="blue"
        />

        <StatCard
          title="Completion Rate"
          value={`${analytics.completionRate.toFixed(1)}%`}
          subtitle={`${analytics.completedFeatures} of ${analytics.totalFeatures} completed`}
          icon={Target}
          color="green"
        />

        <StatCard
          title="Hours Tracked"
          value={analytics.totalHoursTracked.toFixed(1)}
          subtitle={`Avg ${analytics.averageCompletionTime.toFixed(1)}h per feature`}
          icon={Clock}
          color="yellow"
        />

        <StatCard
          title="Weekly Velocity"
          value={analytics.recentCompletions}
          subtitle="Features completed last 7 days"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Projects" value={analytics.activeProjects} icon={BarChart3} color="blue" />

        <StatCard title="Active Developers" value={analytics.activeDevelopers} icon={Users} color="green" />

        <StatCard
          title="This Week"
          value={analytics.recentCompletions}
          subtitle="Completed features"
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleChart data={velocityData} title="7-Day Velocity Trend" />

        <div className="bg-gradient-to-br from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 rounded-xl p-6 shadow-sm border border-bolt-elements-borderColor hover:shadow-lg transition-all duration-300">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Status Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary">Completed</span>
              <div className="flex items-center">
                <div className="w-24 h-2 bg-bolt-elements-background-depth-1 rounded-full mr-3">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${analytics.completionRate}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-bolt-elements-textPrimary">
                  {analytics.completedFeatures}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary">In Progress</span>
              <div className="flex items-center">
                <div className="w-24 h-2 bg-bolt-elements-background-depth-1 rounded-full mr-3">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${analytics.totalFeatures > 0 ? (analytics.inProgressFeatures / analytics.totalFeatures) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-bolt-elements-textPrimary">
                  {analytics.inProgressFeatures}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textSecondary">Pending</span>
              <div className="flex items-center">
                <div className="w-24 h-2 bg-bolt-elements-background-depth-1 rounded-full mr-3">
                  <div
                    className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${analytics.totalFeatures > 0 ? ((analytics.totalFeatures - analytics.completedFeatures - analytics.inProgressFeatures) / analytics.totalFeatures) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-bolt-elements-textPrimary">
                  {analytics.totalFeatures - analytics.completedFeatures - analytics.inProgressFeatures}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
