import React from 'react';
import type { SubtitleStyle } from '../types';

interface SubtitleStylePickerProps {
    style: SubtitleStyle;
    onChange: (style: SubtitleStyle) => void;
}

const PRESET_COLORS = [
    '#FFFFFF', '#FFD700', '#00FF88', '#FF6B6B',
    '#00D4FF', '#FF69B4', '#A855F7', '#F97316',
];

const FONT_OPTIONS = [
    { id: 'Arial, sans-serif', name: 'Arial' },
    { id: '"Segoe UI", sans-serif', name: 'Segoe UI' },
    { id: '"Georgia", serif', name: 'Georgia' },
    { id: '"Courier New", monospace', name: 'Courier' },
];

export const SubtitleStylePicker: React.FC<SubtitleStylePickerProps> = ({ style, onChange }) => {
    const update = (partial: Partial<SubtitleStyle>) => onChange({ ...style, ...partial });

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-4">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Subtitle Uslubi</h4>

            {/* Active Word Color */}
            <div>
                <label className="block text-xs text-slate-400 mb-1.5">Aktiv So'z Rangi</label>
                <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => update({ activeColor: color })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${style.activeColor === color ? 'border-white scale-110 ring-2 ring-indigo-400' : 'border-slate-600 hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                            aria-label={`Rangni tanlash: ${color}`}
                        />
                    ))}
                </div>
            </div>

            {/* Default Text Color */}
            <div>
                <label className="block text-xs text-slate-400 mb-1.5">Matn Rangi</label>
                <div className="flex gap-2 flex-wrap">
                    {['#FFFFFF', '#E2E8F0', '#94A3B8', '#FFD700', '#00D4FF'].map(color => (
                        <button
                            key={color}
                            onClick={() => update({ defaultColor: color })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${style.defaultColor === color ? 'border-white scale-110 ring-2 ring-indigo-400' : 'border-slate-600 hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                            aria-label={`Matn rangini tanlash: ${color}`}
                        />
                    ))}
                </div>
            </div>

            {/* Font Family */}
            <div>
                <label className="block text-xs text-slate-400 mb-1.5">Shrift</label>
                <div className="flex gap-2 flex-wrap">
                    {FONT_OPTIONS.map(font => (
                        <button
                            key={font.id}
                            onClick={() => update({ fontFamily: font.id })}
                            className={`px-3 py-1.5 text-sm rounded-md border transition ${style.fontFamily === font.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                            style={{ fontFamily: font.id }}
                        >
                            {font.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Size */}
            <div>
                <label className="block text-xs text-slate-400 mb-1.5">O'lcham: {style.fontSize}px</label>
                <input
                    type="range"
                    min="24"
                    max="60"
                    value={style.fontSize}
                    onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500"
                />
            </div>

            {/* Background toggle */}
            <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={style.bgEnabled}
                        onChange={(e) => update({ bgEnabled: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-600 peer-checked:bg-indigo-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-xs text-slate-400">Fon</span>
            </div>
        </div>
    );
};
