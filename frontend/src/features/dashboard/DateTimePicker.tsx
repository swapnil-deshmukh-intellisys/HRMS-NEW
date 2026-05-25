import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addHours,
  addMinutes,
  setHours,
  setMinutes,
  isBefore,
  startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import './DateTimePicker.css';

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

export default function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(value));
  
  // Local state for typing and focus tracking
  const [tempHours, setTempHours] = useState(format(value, 'hh'));
  const [tempMinutes, setTempMinutes] = useState(format(value, 'mm'));
  const [isHourFocused, setIsHourFocused] = useState(false);
  const [isMinFocused, setIsMinFocused] = useState(false);

  // Sync temp state when value changes externally, unless currently focused
  React.useEffect(() => {
    if (!isHourFocused) {
      setTempHours(format(value, 'hh'));
    }
  }, [value, isHourFocused]);

  React.useEffect(() => {
    if (!isMinFocused) {
      setTempMinutes(format(value, 'mm'));
    }
  }, [value, isMinFocused]);
  
  // Date Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Time Logic
  const hours = value.getHours();
  const isPM = hours >= 12;

  const handleTimeChange = (type: 'h' | 'm', delta: number) => {
    let newDate = new Date(value);
    if (type === 'h') {
      newDate = addHours(newDate, delta);
      setTempHours(format(newDate, 'hh'));
    } else {
      newDate = addMinutes(newDate, delta);
      setTempMinutes(format(newDate, 'mm'));
    }
    onChange(newDate);
  };

  const handleInputChange = (type: 'h' | 'm', val: string) => {
    const numericVal = val.replace(/\D/g, '').slice(0, 2);
    if (type === 'h') setTempHours(numericVal);
    else setTempMinutes(numericVal);

    if (numericVal.length === 2 || (type === 'h' && parseInt(numericVal) > 1)) {
      commitChange(type, numericVal);
    }
  };

  const commitChange = (type: 'h' | 'm', val: string) => {
    let num = parseInt(val);
    if (isNaN(num)) return;

    let newDate = new Date(value);
    if (type === 'h') {
      if (num < 1) num = 1;
      if (num > 12) num = 12;
      let targetH = num;
      if (isPM && targetH < 12) targetH += 12;
      if (!isPM && targetH === 12) targetH = 0;
      newDate = setHours(newDate, targetH);
    } else {
      if (num < 0) num = 0;
      if (num > 59) num = 59;
      newDate = setMinutes(newDate, num);
    }
    onChange(newDate);
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'h' | 'm') => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleTimeChange(type, 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleTimeChange(type, -1);
    }
  };

  const toggleAMPM = () => {
    let newDate = new Date(value);
    if (isPM) {
      newDate = setHours(newDate, hours - 12);
    } else {
      newDate = setHours(newDate, hours + 12);
    }
    setTempHours(format(newDate, 'hh'));
    setTempMinutes(format(newDate, 'mm'));
    onChange(newDate);
  };

  return (
    <div className="custom-datetime-picker-ui" onClick={(e) => e.stopPropagation()}>
      {/* Calendar Header */}
      <div className="calendar-header">
        <button type="button" onClick={prevMonth} className="nav-btn">
          <ChevronLeft size={20} />
        </button>
        <div className="current-month-label">
          {format(currentMonth, 'MMMM yyyy').toUpperCase()}
        </div>
        <button type="button" onClick={nextMonth} className="nav-btn">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekday Names */}
      <div className="weekday-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="weekday-name">{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="days-grid">
        {calendarDays.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isSelected = isSameDay(day, value);
          const isPast = isBefore(startOfDay(day), startOfDay(new Date()));
          return (
            <button 
              key={i} 
              type="button"
              disabled={isPast}
              className={`calendar-day ${!isCurrentMonth ? 'inactive' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={(e) => {
                if (isPast) return;
                e.stopPropagation();
                const newDate = new Date(value);
                newDate.setFullYear(day.getFullYear());
                newDate.setMonth(day.getMonth());
                newDate.setDate(day.getDate());
                onChange(newDate);
              }}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Time Picker */}
      <div className="time-picker-footer">
        <div className="time-input-group">
          <div className="time-spinner">
            <input 
              type="text" 
              value={tempHours} 
              onChange={(e) => handleInputChange('h', e.target.value)}
              onFocus={() => setIsHourFocused(true)}
              onBlur={() => {
                commitChange('h', tempHours);
                setIsHourFocused(false);
              }}
              onKeyDown={(e) => handleKeyDown(e, 'h')}
              maxLength={2}
            />
            <div className="spinner-controls">
              <button type="button" onClick={() => handleTimeChange('h', 1)}><ChevronUp size={12} /></button>
              <button type="button" onClick={() => handleTimeChange('h', -1)}><ChevronDown size={12} /></button>
            </div>
          </div>
          <span className="separator">:</span>
          <div className="time-spinner">
            <input 
              type="text" 
              value={tempMinutes} 
              onChange={(e) => handleInputChange('m', e.target.value)}
              onFocus={() => setIsMinFocused(true)}
              onBlur={() => {
                commitChange('m', tempMinutes);
                setIsMinFocused(false);
              }}
              onKeyDown={(e) => handleKeyDown(e, 'm')}
              maxLength={2}
            />
            <div className="spinner-controls">
              <button type="button" onClick={() => handleTimeChange('m', 1)}><ChevronUp size={12} /></button>
              <button type="button" onClick={() => handleTimeChange('m', -1)}><ChevronDown size={12} /></button>
            </div>
          </div>
        </div>

        <div className="ampm-toggle">
          <button 
            type="button"
            className={!isPM ? 'active' : ''} 
            onClick={() => isPM && toggleAMPM()}
          >
            AM
          </button>
          <button 
            type="button"
            className={isPM ? 'active' : ''} 
            onClick={() => !isPM && toggleAMPM()}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}
