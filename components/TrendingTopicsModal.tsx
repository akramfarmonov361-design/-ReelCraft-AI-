import React from 'react';
import { IconComponents } from './IconComponents';
import type { TopicCategory } from '../types';

interface TrendingTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  topics: TopicCategory[];
  error: string | null;
  onSelectTopic: (topic: string) => void;
  onRetry: () => void;
}

export const TrendingTopicsModal: React.FC<TrendingTopicsModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  topics,
  error,
  onSelectTopic,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-slate-800 w-full max-w-2xl rounded-lg border border-slate-700 shadow-2xl p-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-3">
            <IconComponents.LightbulbIcon className="w-7 h-7" />
            Ommabop Mavzular
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Yopish">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="overflow-y-auto pr-2 -mr-2">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <IconComponents.LoaderIcon className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
              <p className="text-lg text-slate-300">Eng yaxshi g'oyalar qidirilmoqda...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex flex-col items-center text-center gap-3">
              <IconComponents.ErrorIcon className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="font-bold mb-2">Xatolik yuz berdi</h3>
                <p className="text-sm mb-4">{error}</p>
                <button
                    onClick={onRetry}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-500 transition"
                >
                    Qayta urinish
                </button>
              </div>
            </div>
          )}
          {!isLoading && !error && topics.length > 0 && (
            <div className="space-y-6">
              {topics.map((category, catIndex) => (
                <div key={catIndex}>
                  <h3 className="text-lg font-semibold text-indigo-400 mb-3 sticky top-0 bg-slate-800 py-2 -my-2">{category.category}</h3>
                  <ol className="list-decimal list-inside space-y-2 mt-2">
                    {category.topics.map((topic, topicIndex) => (
                      <li 
                        key={topicIndex} 
                        className="text-slate-300 hover:bg-slate-700/50 p-3 rounded-md cursor-pointer transition-colors"
                        onClick={() => onSelectTopic(topic)}
                        tabIndex={0}
                        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onSelectTopic(topic)}}
                      >
                        <span className="ml-2 font-medium">{topic}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};