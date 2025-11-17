import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Route } from '../models';

const isDebugLoggingEnabled = process.env.ENABLE_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production';

const normalizeTravelDate = (input: string | Date): Date => {
  let date: Date;

  if (input instanceof Date) {
    date = new Date(input.getTime());
  } else {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error('Date value cannot be empty');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      date = new Date(`${trimmed}T00:00:00.000Z`);
    } else {
      date = new Date(trimmed);
    }
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  if (date.getUTCHours() >= 12) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const formatDateKey = (input: string | Date): string => {
  return normalizeTravelDate(input).toISOString().split('T')[0];
};

// GET /api/cities
export const getCities = async (req: Request, res: Response) => {
  try {
    const routes = await Route.find({ active: true }).select('from to');
    
    const citiesSet = new Set<string>();
    routes.forEach(route => {
      citiesSet.add(route.from);
      citiesSet.add(route.to);
    });
    
    const cities = Array.from(citiesSet).sort();
    
    res.json({ cities });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
};

// GET /api/destinations/:from
export const getDestinations = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { from } = req.params;
    
    if (isDebugLoggingEnabled) {
      console.log(`[ROUTE][getDestinations] Fetching destinations for "${from}"`);
    }

    const routes = await Route.find({ 
      from: from,
      active: true 
    }).select('to');
    
    const destinations = routes.map(route => route.to).sort();
    
    if (isDebugLoggingEnabled) {
      console.log(`[ROUTE][getDestinations] Found ${destinations.length} destinations for "${from}"`, destinations);
    }

    res.json({ destinations });
  } catch (error) {
    console.error('[ROUTE][getDestinations] Error fetching destinations:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
};

// GET /api/routes/:from/:to/student-discount - Get student discount for a route
export const getStudentDiscount = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { from, to } = req.params;
    
    const route = await Route.findOne({ 
      from: from,
      to: to,
      active: true 
    }).select('studentDiscount from to');
    
    if (!route) {
      return res.status(404).json({ 
        error: 'Route not found',
        message: `No route available from ${from} to ${to}` 
      });
    }
    
    // Disable caching for this endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Return student discount (null if not available)
    res.json({
      from,
      to,
      studentDiscount: route.studentDiscount || null,
      hasStudentDiscount: !!route.studentDiscount
    });
  } catch (error) {
    console.error('Error fetching student discount:', error);
    res.status(500).json({ error: 'Failed to fetch student discount' });
  }
};

// GET /api/routes/:from/:to/available-days - Get available days for a route
export const getRouteAvailableDays = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { from, to } = req.params;
    
    if (isDebugLoggingEnabled) {
      console.log(`[ROUTE][getRouteAvailableDays] Fetching available days for ${from} -> ${to}`);
    }

    const route = await Route.findOne({ 
      from: from,
      to: to,
      active: true 
    }).select('availableDays closedDates from to');
    
    if (!route) {
      return res.status(404).json({ 
        error: 'Route not found',
        message: `No route available from ${from} to ${to}` 
      });
    }
    
    // Disable caching for this endpoint
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // If availableDays is null or empty, route is available daily
    if (!route.availableDays || route.availableDays.length === 0) {
      if (isDebugLoggingEnabled) {
        console.log(`[ROUTE][getRouteAvailableDays] Route ${from} -> ${to} available daily`);
      }
      return res.json({
        from,
        to,
        availableDaily: true,
        availableDays: null,
        availableDayNames: ['All days'],
        closedDates: route.closedDates || []
      });
    }
    
    // Return available days
    const availableDayNames = route.availableDays.map(day => dayNames[day]).sort();
    
    if (isDebugLoggingEnabled) {
      console.log(`[ROUTE][getRouteAvailableDays] Route ${from} -> ${to} available on days`, route.availableDays, availableDayNames);
    }

    res.json({
      from,
      to,
      availableDaily: false,
      availableDays: route.availableDays.sort(),
      availableDayNames: availableDayNames,
      closedDates: route.closedDates || []
    });
  } catch (error) {
    console.error('Error fetching route available days:', error);
    res.status(500).json({ error: 'Failed to fetch route available days' });
  }
};

// POST /api/trips/search
export const searchTrip = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { from, to, date } = req.body;
    
    if (isDebugLoggingEnabled) {
      console.log('[ROUTE][searchTrip] Incoming search', { from, to, date });
    }

    const route = await Route.findOne({ 
      from: from,
      to: to,
      active: true 
    });
    
    if (!route) {
      if (isDebugLoggingEnabled) {
        console.warn('[ROUTE][searchTrip] Route not found', { from, to });
      }
      return res.status(404).json({ 
        error: 'Route not found',
        message: `No route available from ${from} to ${to}` 
      });
    }
    
    // Check if route is available on the selected date
    const selectedDate = new Date(date);
    const travelDate = normalizeTravelDate(selectedDate);
    const dayOfWeek = travelDate.getUTCDay(); // 0 = Sunday, ..., 6 = Saturday
    
    if (isDebugLoggingEnabled) {
      console.log('[ROUTE][searchTrip] Route found', {
        from: route.from,
        to: route.to,
        active: route.active,
        availableDays: route.availableDays,
        selectedDate: selectedDate.toISOString(),
        normalizedTravelDate: travelDate.toISOString(),
        selectedDayOfWeek: dayOfWeek
      });
    }

    // If availableDays is set and not empty, check if the selected day is available
    if (route.availableDays && route.availableDays.length > 0) {
      if (!route.availableDays.includes(dayOfWeek)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDayNames = route.availableDays.map(day => dayNames[day]).join(', ');
        
        console.warn('[ROUTE][searchTrip] Route not available on selected date', {
          from,
          to,
          requestDate: date,
          selectedDay: dayNames[selectedDate.getDay()],
          normalizedDay: dayNames[dayOfWeek],
          allowedDays: route.availableDays,
          allowedDayNames: availableDayNames
        });

        return res.status(400).json({ 
          error: 'Route not available on selected date',
          message: `This route is only available on: ${availableDayNames}`,
          selectedDate: date,
          selectedDay: dayNames[selectedDate.getDay()],
          normalizedDate: travelDate.toISOString(),
          normalizedDay: dayNames[dayOfWeek],
          availableDays: route.availableDays,
          availableDayNames: availableDayNames
        });
      }
    }
    
    const travelDateKey = formatDateKey(travelDate);

    if (route.closedDates && route.closedDates.includes(travelDateKey)) {
      if (isDebugLoggingEnabled) {
        console.warn('[ROUTE][searchTrip] Route closed for selected date', {
          from,
          to,
          travelDate: travelDateKey,
          closedDates: route.closedDates
        });
      }

      return res.status(400).json({
        error: 'Route closed on selected date',
        message: 'Bookings are temporarily closed for the selected date',
        requestedDate: date,
        travelDate: travelDateKey,
        closedDates: route.closedDates
      });
    }

    // Calculate price (could add dynamic pricing logic here)
    const price = route.basePrice;
    
    if (isDebugLoggingEnabled) {
      console.log('[ROUTE][searchTrip] Route available for booking', {
        from: route.from,
        to: route.to,
        date,
        price,
        currency: route.currency
      });
    }

    const normalizedIso = travelDate.toISOString();

    res.json({
      from: route.from,
      to: route.to,
      date: normalizedIso,
      travelDate: normalizedIso,
      requestedDate: date,
      price: price,
      currency: route.currency,
      departureTime: route.departureTime,
      arrivalTime: route.arrivalTime,
      fromStation: route.fromStation,
      toStation: route.toStation,
      availableDays: route.availableDays || null, // null = available daily
      isAvailableOnSelectedDate: true,
      isClosed: false,
      closedDates: route.closedDates || []
    });
  } catch (error) {
    console.error('Error searching trip:', error);
    res.status(500).json({ error: 'Failed to search trip' });
  }
};

const normalizeAvailableDays = (value: unknown): number[] | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeAvailableDays(parsed);
    } catch (error) {
      throw new Error('availableDays string must be valid JSON array');
    }
  }

  if (!Array.isArray(value)) {
    throw new Error('availableDays must be an array of day indexes (0-6)');
  }

  if (value.length === 0) {
    return null;
  }

  const normalized = Array.from(
    new Set(
      value.map((day) => {
        const parsed = Number(day);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
          throw new Error('availableDays must only contain integers between 0 and 6');
        }
        return parsed;
      })
    )
  ).sort();

  return normalized.length > 0 ? normalized : null;
};

const normalizeClosedDates = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  const parseArray = (candidate: unknown): unknown[] => {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return [];
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [parsed];
      } catch (_error) {
        return trimmed
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }
    return [candidate];
  };

  const values = parseArray(value);

  const normalized = Array.from(
    new Set(
      values.map((item) => {
        if (item === null || item === undefined || item === '') {
          throw new Error('closedDates entries cannot be empty');
        }
        return formatDateKey(
          item instanceof Date ? item : String(item)
        );
      })
    )
  ).sort();

  return normalized;
};

// GET /api/admin/routes - List all routes (optionally filter by active state)
export const getAllRoutesAdmin = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (isDebugLoggingEnabled) {
      console.warn('[ROUTE][admin][getAllRoutes] Validation failed', errors.array());
    }
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { active } = req.query;

    const filter: Record<string, unknown> = {};
    if (typeof active === 'boolean') {
      filter.active = active;
    }

    const routes = await Route.find(filter).sort({ createdAt: -1 }).lean();
    res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
};

// POST /api/admin/routes - Create a new route
export const createRoute = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (isDebugLoggingEnabled) {
      console.warn('[ROUTE][admin][createRoute] Validation failed', errors.array());
    }
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      from,
      to,
      basePrice,
      currency,
      departureTime,
      arrivalTime,
      fromStation,
      toStation,
      active,
      availableDays,
      studentDiscount,
      closedDates
    } = req.body;

    let normalizedAvailableDays: number[] | null = null;
    try {
      normalizedAvailableDays = normalizeAvailableDays(availableDays);
    } catch (normalizationError) {
      return res.status(400).json({ error: (normalizationError as Error).message });
    }

    let normalizedClosedDates: string[] | undefined;
    try {
      normalizedClosedDates = normalizeClosedDates(closedDates);
    } catch (normalizationError) {
      return res.status(400).json({ error: (normalizationError as Error).message });
    }

    const route = await Route.create({
      from,
      to,
      basePrice: Number(basePrice),
      currency,
      departureTime,
      arrivalTime,
      fromStation,
      toStation,
      active: typeof active === 'boolean' ? active : true,
      availableDays: normalizedAvailableDays,
      studentDiscount:
        studentDiscount === null || studentDiscount === undefined
          ? null
          : Number(studentDiscount),
      closedDates: normalizedClosedDates
    });

    res.status(201).json(route.toObject());
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Failed to create route' });
  }
};

// PATCH /api/admin/routes/:id - Update an existing route
export const updateRoute = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (isDebugLoggingEnabled) {
      console.warn('[ROUTE][admin][updateRoute] Validation failed', errors.array());
    }
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;

    const updateData: Record<string, unknown> = {};

    const mutableFields: Array<'from' | 'to' | 'basePrice' | 'currency' | 'departureTime' | 'arrivalTime' | 'fromStation' | 'toStation' | 'active' | 'availableDays' | 'studentDiscount' | 'closedDates'> = [
      'from',
      'to',
      'basePrice',
      'currency',
      'departureTime',
      'arrivalTime',
      'fromStation',
      'toStation',
      'active',
      'availableDays',
      'studentDiscount',
      'closedDates'
    ];

    mutableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateData, 'availableDays')) {
      try {
        updateData.availableDays = normalizeAvailableDays(updateData.availableDays);
      } catch (normalizationError) {
        return res.status(400).json({ error: (normalizationError as Error).message });
      }
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'basePrice')) {
      updateData.basePrice = Number(updateData.basePrice);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'studentDiscount')) {
      const value = updateData.studentDiscount;
      updateData.studentDiscount = value === null || value === undefined ? null : Number(value);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'closedDates')) {
      try {
        updateData.closedDates = normalizeClosedDates(updateData.closedDates);
      } catch (normalizationError) {
        return res.status(400).json({ error: (normalizationError as Error).message });
      }
    }

    const route = await Route.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).lean();

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Failed to update route' });
  }
};

// DELETE /api/admin/routes/:id - Remove a route
export const deleteRoute = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;

    const deleted = await Route.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
};

// POST /api/admin/routes/:id/closed-dates - Add a closed date for a route
export const addClosedDate = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { date } = req.body;

    let dateKey: string;
    try {
      dateKey = formatDateKey(date);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }

    const route = await Route.findById(id);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    if (!route.closedDates) {
      route.closedDates = [];
    }

    if (!route.closedDates.includes(dateKey)) {
      route.closedDates.push(dateKey);
      route.closedDates.sort();
      await route.save();
    }

    if (isDebugLoggingEnabled) {
      console.log('[ROUTE][admin][addClosedDate] Closed date added', {
        routeId: id,
        date: dateKey,
        closedDates: route.closedDates
      });
    }

    res.json({
      message: 'Route closed for selected date',
      route: route.toObject()
    });
  } catch (error) {
    console.error('Error adding closed date:', error);
    res.status(500).json({ error: 'Failed to add closed date' });
  }
};

// DELETE /api/admin/routes/:id/closed-dates/:date - Remove a closed date for a route
export const removeClosedDate = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id, date } = req.params;

    let dateKey: string;
    try {
      dateKey = formatDateKey(date);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }

    const route = await Route.findById(id);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const initialLength = route.closedDates?.length || 0;
    route.closedDates = (route.closedDates || []).filter((item) => item !== dateKey);

    if (route.closedDates.length !== initialLength) {
      await route.save();
    }

    if (isDebugLoggingEnabled) {
      console.log('[ROUTE][admin][removeClosedDate] Closed date removed', {
        routeId: id,
        date: dateKey,
        closedDates: route.closedDates
      });
    }

    res.json({
      message: 'Route reopened for selected date',
      route: route.toObject()
    });
  } catch (error) {
    console.error('Error removing closed date:', error);
    res.status(500).json({ error: 'Failed to remove closed date' });
  }
};
