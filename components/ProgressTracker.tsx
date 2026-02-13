import React, { useState, useEffect, useRef } from 'react';
import type { ProgressStep } from '../types';
import { IconComponents } from './IconComponents';

interface ProgressTrackerProps {
  steps: ProgressStep[];
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ steps }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = steps.some(s => s.status === 'running');

  useEffect(() => {
    if (isRunning && !timerRef.current) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else if (!isRunning && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // Calculate overall progress
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const runningStep = steps.find(s => s.status === 'running');
  const runningProgress = runningStep?.progress || 0;
  const overallProgress = Math.round(((completedSteps + runningProgress / 100) / totalSteps) * 100);

  // Estimated time
  const estimatedTotal = overallProgress > 5 ? Math.round(elapsedSeconds / (overallProgress / 100)) : 0;
  const remainingSeconds = Math.max(0, estimatedTotal - elapsedSeconds);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}d ${sec}s` : `${sec}s`;
  };

  const getStatusIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'running':
        return <IconComponents.LoaderIcon className="w-5 h-5 text-cyan-400 animate-spin" />;
      case 'complete':
        return <IconComponents.CheckIcon className="w-5 h-5 text-green-400" />;
      case 'error':
        return <IconComponents.ErrorIcon className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <div className="w-5 h-5 border-2 border-slate-500 rounded-full" />;
    }
  };

  const getStatusColor = (status: ProgressStep['status']) => {
    switch (status) {
      case 'running': return 'text-cyan-300';
      case 'complete': return 'text-green-300';
      case 'error': return 'text-red-300';
      case 'pending': return 'text-slate-500';
    }
  }

  return (
    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-300">Yaratish Jarayoni</h3>
        <div className="flex items-center gap-3">
          {isRunning && remainingSeconds > 0 && (
            <span className="text-xs text-slate-400">~{formatTime(remainingSeconds)} qoldi</span>
          )}
          <span className="text-sm font-bold text-cyan-400">{overallProgress}%</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2.5 mb-5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-around gap-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {getStatusIcon(step.status)}
            </div>
            <div>
              <span className={`font-medium ${getStatusColor(step.status)}`}>
                {step.label}
              </span>
              {step.detail && (
                <span className="text-xs text-slate-400 ml-2">({step.detail})</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isRunning && (
        <div className="mt-3 text-center">
          <span className="text-xs text-slate-500">⏱ {formatTime(elapsedSeconds)} o'tdi</span>
        </div>
      )}
    </div>
  );
};