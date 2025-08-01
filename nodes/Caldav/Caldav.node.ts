import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

import * as dav from 'dav';

/**
 * Enum для частот повторения событий в RRULE
 */
enum RecurrenceFrequency {
	DAILY = 'DAILY',
	WEEKLY = 'WEEKLY',
	MONTHLY = 'MONTHLY',
	YEARLY = 'YEARLY'
}

/**
 * Структура объекта календаря DAV
 */
interface CalendarObject {
	url: string;
	displayName?: string;
	name?: string;
	description?: string;
	componentSet?: string[];
}

/**
 * Календарь с URL и объектами
 */
interface Calendar {
	url: string;
	objects?: CalendarObject[];
}

/**
 * Событие календаря с поддержкой различных форматов дат
 */
interface CalendarEvent {
	summary?: string;
	start?: Date | string; // iCal может содержать строки дат
	end?: Date | string;   // iCal может содержать строки дат
	description?: string;
	location?: string;
	uid?: string;
	url?: string;
	etag?: string;
	calendarData?: string;
}

/**
 * Структура парсинга iCal даты
 */
interface ParsedICalDate {
	date: Date;
	timezone?: string;
	isUtc: boolean;
	originalString: string;
}

/**
 * Образец события для отладки и анализа данных календаря
 */
interface SampleEvent {
	error?: string;
	objectIndex?: number;
	totalVEventBlocks?: number;
	firstVEventPreview?: string;
	calendarDataStart?: string;
	eventIndex?: number;
	dtStart?: string;
	summary?: string;
	eventDataPreview?: string;
}

export class Caldav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CalDAV',
		name: 'caldav',
		icon: 'file:caldav.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with CalDAV calendars',
		usableAsTool: true,
		defaults: {
			name: 'CalDAV',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'caldavApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getEvents',
				options: [
					{
						name: 'Get Events',
						value: 'getEvents',
						description: 'Get calendar events for a specific date',
						action: 'Get events',
					},
				],
			},
			{
				displayName: 'Calendar Name or ID',
				name: 'calendarUrl',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getCalendars',
				},
				displayOptions: {
					show: {
						operation: ['getEvents'],
					},
				},
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'dateTime',
				default: '',
				description: 'Date to get events for',
				displayOptions: {
					show: {
						operation: ['getEvents'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getCalendars(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('caldavApi');

					// Создаем транспорт для аутентификации
					const xhr = new dav.transport.Basic(
						new dav.Credentials({
							username: credentials.username as string,
							password: credentials.password as string,
						})
					);

					// Создаем аккаунт CalDAV и загружаем календари
					const account = await dav.createAccount({
						server: credentials.serverUrl as string,
						xhr: xhr,
						accountType: 'caldav',
						loadCollections: true,
						loadObjects: false,
					});

					// Преобразуем календари в опции для выпадающего списка
					const calendarOptions: INodePropertyOptions[] = [];

					for (const calendar of account.calendars) {
						// Извлекаем относительный путь календаря (убираем serverUrl)
						const serverUrl = credentials.serverUrl as string;
						let calendarPath = calendar.url;
						
						if (calendarPath.startsWith(serverUrl)) {
							calendarPath = calendarPath.substring(serverUrl.length);
						}
						
						// Если путь не начинается с /, добавляем его
						if (!calendarPath.startsWith('/')) {
							calendarPath = '/' + calendarPath;
						}

						// Пытаемся получить красивое название календаря
						let calendarName = '';
						
						// Проверяем доступные свойства календаря для названия
						if ((calendar as CalendarObject).displayName) {
							calendarName = (calendar as CalendarObject).displayName!;
						} else if ((calendar as CalendarObject).name) {
							calendarName = (calendar as CalendarObject).name!;
						} else if ((calendar as CalendarObject).description) {
							calendarName = (calendar as CalendarObject).description!;
						} else {
							// Fallback: извлекаем название из URL (последняя часть пути)
							const pathParts = calendarPath.split('/').filter(part => part.length > 0);
							calendarName = pathParts[pathParts.length - 1] || calendarPath;
							
							// Убираем trailing slash если есть
							if (calendarName.endsWith('/')) {
								calendarName = calendarName.slice(0, -1);
							}
						}

						// Проверяем тип календаря по URL и свойствам
						let calendarType = 'Календарь';
						if (calendarPath.includes('events') || (calendar as CalendarObject).componentSet?.includes('VEVENT')) {
							calendarType = 'События';
						} else if (calendarPath.includes('todos') || calendarPath.includes('tasks') || (calendar as CalendarObject).componentSet?.includes('VTODO')) {
							calendarType = 'Задачи';
						}

						// Формируем финальное название
						const displayName = calendarName ? `${calendarName} (${calendarType})` : `${calendarType} - ${calendarPath}`;

						calendarOptions.push({
							name: displayName,
							value: calendarPath,
							description: `Путь: ${calendarPath}${(calendar as CalendarObject).description ? ` | ${(calendar as CalendarObject).description}` : ''}`,
						});
					}

					// Сортируем календари по названию
					calendarOptions.sort((a, b) => a.name.localeCompare(b.name));

					return calendarOptions;

				} catch (error) {
					// Возвращаем заглушку при ошибке для отладки
					return [
						{
							name: 'Ошибка загрузки календарей',
							value: '/calendars/error',
							description: `Ошибка: ${(error as Error).message}`,
						},
					];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('caldavApi');

		// Улучшенная функция для парсинга iCal дат с поддержкой таймзон
		const parseICalDate = (dateStr: string, eventData: string): ParsedICalDate | null => {
			try {
				const cleanDateStr = dateStr.trim();
				let date: Date;
				let timezone: string | undefined;
				let isUtc = false;

				// Поиск VTIMEZONE в eventData для определения таймзоны
				const timezoneMatch = eventData.match(/DTSTART;TZID=([^:]+):/);
				if (timezoneMatch) {
					timezone = timezoneMatch[1];
				}

				// Парсинг различных форматов дат
				if (cleanDateStr.endsWith('Z')) {
					// UTC формат: 20231025T120000Z
					isUtc = true;
					const year = parseInt(cleanDateStr.substring(0, 4));
					const month = parseInt(cleanDateStr.substring(4, 6)) - 1;
					const day = parseInt(cleanDateStr.substring(6, 8));
					
					if (cleanDateStr.includes('T')) {
						const hour = parseInt(cleanDateStr.substring(9, 11));
						const minute = parseInt(cleanDateStr.substring(11, 13));
						const second = parseInt(cleanDateStr.substring(13, 15));
						date = new Date(Date.UTC(year, month, day, hour, minute, second));
					} else {
						date = new Date(Date.UTC(year, month, day));
					}
				} else if (cleanDateStr.includes('T')) {
					// Формат с временем: YYYYMMDDTHHMMSS
					const year = parseInt(cleanDateStr.substring(0, 4));
					const month = parseInt(cleanDateStr.substring(4, 6)) - 1;
					const day = parseInt(cleanDateStr.substring(6, 8));
					const hour = parseInt(cleanDateStr.substring(9, 11));
					const minute = parseInt(cleanDateStr.substring(11, 13));
					const second = parseInt(cleanDateStr.substring(13, 15));
					
					if (timezone) {
						// Если есть таймзона, создаем дату как локальную, но помечаем таймзону
						date = new Date(year, month, day, hour, minute, second);
					} else {
						// Локальное время
						date = new Date(year, month, day, hour, minute, second);
					}
				} else if (cleanDateStr.includes('-')) {
					// Формат YYYY-MM-DD
					date = new Date(cleanDateStr);
				} else if (cleanDateStr.length === 8) {
					// Формат YYYYMMDD (только дата)
					const year = parseInt(cleanDateStr.substring(0, 4));
					const month = parseInt(cleanDateStr.substring(4, 6)) - 1;
					const day = parseInt(cleanDateStr.substring(6, 8));
					date = new Date(year, month, day);
				} else {
					return null;
				}

				return {
					date,
					timezone,
					isUtc,
					originalString: cleanDateStr
				};
			} catch (error) {
				return null;
			}
		};

		// Функция для конвертации в ISO формат с учетом таймзоны
		const toISOWithTimezone = (parsedDate: ParsedICalDate): string => {
			if (parsedDate.isUtc) {
				return parsedDate.date.toISOString();
			} else if (parsedDate.timezone) {
				// Если есть таймзона, добавляем информацию о ней
				return parsedDate.date.toISOString() + ` (${parsedDate.timezone})`;
			} else {
				// Локальное время
				return parsedDate.date.toISOString();
			}
		};

		// Функция для проверки исключенных дат (EXDATE)
		const isDateExcluded = (targetDate: Date, eventData: string): boolean => {
			const exdateMatches = eventData.match(/EXDATE[^:]*:([^\r\n]+)/g);
			if (!exdateMatches) return false;
			
			for (const exdateMatch of exdateMatches) {
				const dateMatch = exdateMatch.match(/EXDATE[^:]*:([^\r\n]+)/);
				if (dateMatch) {
					const exDateStr = dateMatch[1].trim();
					const parsedExDate = parseICalDate(exDateStr, eventData);
					if (parsedExDate) {
						// Сравниваем только дату, игнорируя время
						const exDate = parsedExDate.date;
						if (exDate.getFullYear() === targetDate.getFullYear() &&
							exDate.getMonth() === targetDate.getMonth() &&
							exDate.getDate() === targetDate.getDate()) {
							return true;
						}
					}
				}
			}
			return false;
		};

		// Улучшенная функция для проверки повторяющихся событий
		const isRecurringEventOnDate = (eventStartDate: Date, targetDate: Date, rrule: string, eventData: string): boolean => {
			// Если событие началось после целевой даты, оно не может повториться в прошлом
			if (eventStartDate > targetDate) {
				return false;
			}

			// Проверяем исключенные даты (EXDATE)
			if (isDateExcluded(targetDate, eventData)) {
				return false;
			}

			// Парсим правило повторения
			const rruleParts = rrule.split(';');
			const rules: Record<string, string> = {};
			
			for (const part of rruleParts) {
				const [key, value] = part.split('=');
				if (key && value) {
					rules[key] = value;
				}
			}

			const freq = rules['FREQ'];
			if (!freq) return false;

			// Проверяем окончание повторения
			if (rules['UNTIL']) {
				const untilDate = parseICalDate(rules['UNTIL'], '');
				if (untilDate && targetDate > untilDate.date) {
					return false;
				}
			}

			// Проверяем количество повторений
			if (rules['COUNT']) {
				const count = parseInt(rules['COUNT']);
				const interval = parseInt(rules['INTERVAL'] || '1');
				
				// Рассчитываем количество прошедших интервалов
				const diffTime = targetDate.getTime() - eventStartDate.getTime();
				const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
				
				let intervalsPassed = 0;
				switch (freq) {
					case RecurrenceFrequency.DAILY:
						intervalsPassed = Math.floor(diffDays / interval);
						break;
					case RecurrenceFrequency.WEEKLY:
						intervalsPassed = Math.floor(diffDays / (7 * interval));
						break;
					case RecurrenceFrequency.MONTHLY:
						// Приблизительный расчет для месяцев
						intervalsPassed = Math.floor(diffDays / (30 * interval));
						break;
					case RecurrenceFrequency.YEARLY:
						intervalsPassed = Math.floor(diffDays / (365 * interval));
						break;
				}
				
				if (intervalsPassed >= count) {
					return false;
				}
			}

			// Рассчитываем соответствие дат для каждой частоты
			const interval = parseInt(rules['INTERVAL'] || '1');

			switch (freq) {
				case RecurrenceFrequency.DAILY: {
					const daysDiff = Math.floor((targetDate.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24));
					return daysDiff >= 0 && daysDiff % interval === 0;
				}

				case RecurrenceFrequency.WEEKLY: {
					// Проверяем дни недели (BYDAY) - ОБЯЗАТЕЛЬНО для недельных событий
					if (rules['BYDAY']) {
						const allowedDays = rules['BYDAY'].split(',');
						const targetDayOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDate.getDay()];
						if (!allowedDays.includes(targetDayOfWeek)) {
							return false;
						}
					} else {
						// Если BYDAY не указан, проверяем тот же день недели что и исходное событие
						if (targetDate.getDay() !== eventStartDate.getDay()) {
							return false;
						}
					}
					
					// Вычисляем количество недель между исходным событием и целевой датой
					const msPerDay = 24 * 60 * 60 * 1000;
					const msPerWeek = 7 * msPerDay;
					
					// Находим начало недели для исходного события (понедельник)
					const eventWeekStart = new Date(eventStartDate);
					eventWeekStart.setDate(eventStartDate.getDate() - ((eventStartDate.getDay() + 6) % 7));
					eventWeekStart.setHours(0, 0, 0, 0);
					
					// Находим начало недели для целевой даты
					const targetWeekStart = new Date(targetDate);
					targetWeekStart.setDate(targetDate.getDate() - ((targetDate.getDay() + 6) % 7));
					targetWeekStart.setHours(0, 0, 0, 0);
					
					// Вычисляем разность в неделях
					const weeksDiff = Math.floor((targetWeekStart.getTime() - eventWeekStart.getTime()) / msPerWeek);
					
					// Проверяем соответствие интервалу
					return weeksDiff >= 0 && weeksDiff % interval === 0;
				}

				case RecurrenceFrequency.MONTHLY: {
					// Проверяем конкретный день месяца (BYMONTHDAY)
					if (rules['BYMONTHDAY']) {
						const monthDay = parseInt(rules['BYMONTHDAY']);
						if (targetDate.getDate() !== monthDay) {
							return false;
						}
					} else {
						// Базовая проверка - тот же день месяца, что и в оригинальном событии
						if (targetDate.getDate() !== eventStartDate.getDate()) {
							return false;
						}
					}
					
					// Проверяем месячный интервал
					const monthsDiff = (targetDate.getFullYear() - eventStartDate.getFullYear()) * 12 
						+ (targetDate.getMonth() - eventStartDate.getMonth());
					
					return monthsDiff >= 0 && monthsDiff % interval === 0;
				}

				case RecurrenceFrequency.YEARLY: {
					// Проверяем, что это тот же день и месяц
					if (targetDate.getDate() !== eventStartDate.getDate() || 
						targetDate.getMonth() !== eventStartDate.getMonth()) {
						return false;
					}
					
					const yearsDiff = targetDate.getFullYear() - eventStartDate.getFullYear();
					return yearsDiff >= 0 && yearsDiff % interval === 0;
				}

				default:
					return false;
			}
		};

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'getEvents') {
					const calendarUrl = this.getNodeParameter('calendarUrl', i) as string;
					const date = this.getNodeParameter('date', i) as string;

					// Создаем транспорт для аутентификации
					const xhr = new dav.transport.Basic(
						new dav.Credentials({
							username: credentials.username as string,
							password: credentials.password as string,
						})
					);

					try {
						// Создаем аккаунт CalDAV
						const account = await dav.createAccount({
							server: credentials.serverUrl as string,
							xhr: xhr,
							accountType: 'caldav',
							loadCollections: true,
							loadObjects: false,
						});

						// Находим нужный календарь по URL
						const fullCalendarUrl = `${credentials.serverUrl}${calendarUrl}`;
						
						const calendar = account.calendars.find((cal: Calendar) => 
							cal.url === fullCalendarUrl || cal.url.endsWith(calendarUrl)
						);

						if (!calendar) {
							// Подготовим удобный список календарей для пользователя
							const calendarList = account.calendars.map((cal: Calendar) => {
								const serverUrl = credentials.serverUrl as string;
								let calendarPath = cal.url;
								
								// Убираем serverUrl для краткости
								if (calendarPath.startsWith(serverUrl)) {
									calendarPath = calendarPath.substring(serverUrl.length);
								}
								
								// Определяем тип календаря
								let type = 'календарь';
								if (calendarPath.includes('events')) {
									type = 'события';
								} else if (calendarPath.includes('todos') || calendarPath.includes('tasks')) {
									type = 'задачи';
								}
								
								return `  📅 ${calendarPath} (${type})`;
							}).join('\n');

							throw new NodeOperationError(
								this.getNode(),
								`❌ Календарь не найден: ${calendarUrl}\n\n📋 Доступные календари:\n${calendarList}\n\n💡 Скопируйте нужный путь из списка выше в поле "Calendar URL"`,
								{ level: 'warning' }
							);
						}

						// Формируем диапазон дат для запроса (день с 00:00 до 23:59)
						const targetDate = new Date(date);
						const startDate = new Date(targetDate);
						startDate.setHours(0, 0, 0, 0);
						
						const endDate = new Date(targetDate);
						endDate.setHours(23, 59, 59, 999);

						// Синхронизируем календарь и получаем события
						const syncedCalendar = await dav.syncCalendar(calendar, {
							xhr: xhr,
							syncMethod: 'basic',
						});
						
						// Если объектов нет после синхронизации, пробуем создать account с загрузкой объектов
						let calendarObjects = syncedCalendar.objects || [];
						
						if (calendarObjects.length === 0) {
							// Создаем новый аккаунт с загрузкой объектов
							const accountWithObjects = await dav.createAccount({
								server: credentials.serverUrl as string,
								xhr: xhr,
								accountType: 'caldav',
								loadCollections: true,
								loadObjects: true,
							});
							
							// Находим тот же календарь в новом аккаунте
							const calendarWithObjects = accountWithObjects.calendars.find((cal: Calendar) => 
								cal.url === calendar.url
							);
							
							if (calendarWithObjects && calendarWithObjects.objects) {
								calendarObjects = calendarWithObjects.objects;
							}
						}
						
						// Фильтруем события по дате
						const eventsForDate: CalendarEvent[] = [];
						
						for (const obj of calendarObjects) {
							if (!obj.calendarData) continue;
							
							const calendarData = obj.calendarData;
							
							// Извлекаем все блоки VEVENT
							const veventBlocks = calendarData.split('BEGIN:VEVENT').slice(1);
							
							for (const veventBlock of veventBlocks) {
								if (!veventBlock.includes('END:VEVENT')) continue;
								
								const eventData = 'BEGIN:VEVENT' + veventBlock.split('END:VEVENT')[0] + 'END:VEVENT';
								
								// Ищем DTSTART в конкретном событии
								const eventDateMatches = [
									eventData.match(/DTSTART[^:]*:(\d{8}T\d{6}Z?)/), // Формат YYYYMMDDTHHMMSSZ
									eventData.match(/DTSTART[^:]*:(\d{8})/), // Формат YYYYMMDD
									eventData.match(/DTSTART[^:]*:(\d{4}-\d{2}-\d{2})/), // Формат YYYY-MM-DD
								];
								
								for (const match of eventDateMatches) {
									if (!match) continue;
									
									const dateStr = match[1];
									const parsedDate = parseICalDate(dateStr, eventData);
									
									if (!parsedDate) continue;
									
									const eventDate = parsedDate.date;
									
									// Проверяем прямое совпадение даты
									if (eventDate.toDateString() === targetDate.toDateString()) {
										eventsForDate.push({
											...obj,
											calendarData: eventData
										});
										break;
									}
									
									// Проверяем правила повторения (RRULE)
									const rruleMatch = eventData.match(/RRULE:([^\r\n]+)/);
									if (rruleMatch && isRecurringEventOnDate(eventDate, targetDate, rruleMatch[1], eventData)) {
										eventsForDate.push({
											...obj,
											calendarData: eventData
										});
									}
									break;
								}
							}
						}

						// Обрабатываем найденные события
						for (const event of eventsForDate) {
							const eventData = event.calendarData;
							
							// Проверяем, что eventData существует
							if (!eventData) {
								continue;
							}
							
							// Извлекаем основную информацию о событии
							const summaryMatch = eventData.match(/SUMMARY:(.+)/);
							const descriptionMatch = eventData.match(/DESCRIPTION:(.+)/);
							const dtStartMatch = eventData.match(/DTSTART[^:]*:(.+)/);
							const dtEndMatch = eventData.match(/DTEND[^:]*:(.+)/);
							const uidMatch = eventData.match(/UID:(.+)/);
							const locationMatch = eventData.match(/LOCATION:(.+)/);
							const webUrlMatch = eventData.match(/URL:(.+)/);

							// Парсим даты для ISO формата
							const dtStartRaw = dtStartMatch ? dtStartMatch[1].trim() : '';
							const dtEndRaw = dtEndMatch ? dtEndMatch[1].trim() : '';
							
							const parsedStartDate = dtStartRaw ? parseICalDate(dtStartRaw, eventData) : null;
							const parsedEndDate = dtEndRaw ? parseICalDate(dtEndRaw, eventData) : null;

							const eventInfo = {
								uid: uidMatch ? uidMatch[1].trim() : '',
								summary: summaryMatch ? summaryMatch[1].trim() : '',
								description: descriptionMatch ? descriptionMatch[1].trim() : '',
								location: locationMatch ? locationMatch[1].trim() : '',
								webUrl: webUrlMatch ? webUrlMatch[1].trim() : '',
								dtStart: dtStartRaw,
								dtEnd: dtEndRaw,
								dtStartISO: parsedStartDate ? toISOWithTimezone(parsedStartDate) : '',
								dtEndISO: parsedEndDate ? toISOWithTimezone(parsedEndDate) : '',
								url: event.url,
								etag: event.etag,
								calendarData: eventData,
							};

							returnData.push({
								json: eventInfo,
								pairedItem: {
									item: i,
								},
							});
						}

						// Если событий не найдено, возвращаем информацию о поиске
						if (eventsForDate.length === 0) {
							// Добавляем примеры событий для отладки
							const sampleEvents: SampleEvent[] = [];
							
							// Анализируем первые несколько объектов календаря
							for (let i = 0; i < Math.min(2, calendarObjects.length); i++) {
								const obj = calendarObjects[i];
								if (!obj.calendarData) {
									sampleEvents.push({ error: 'No calendarData' });
									continue;
								}
								
								const calendarData = obj.calendarData;
								const veventBlocks = calendarData.split('BEGIN:VEVENT').slice(1);
								
								sampleEvents.push({
									objectIndex: i,
									totalVEventBlocks: veventBlocks.length,
									firstVEventPreview: veventBlocks.length > 0 ? 
										('BEGIN:VEVENT' + veventBlocks[0].split('END:VEVENT')[0]).substring(0, 300) + '...' : 'No VEVENT found',
									calendarDataStart: calendarData.substring(0, 200) + '...'
								});
								
								// Показываем первые 2 события из этого объекта
								for (let j = 0; j < Math.min(2, veventBlocks.length); j++) {
									const veventBlock = veventBlocks[j];
									if (!veventBlock.includes('END:VEVENT')) continue;
									
									const eventData = 'BEGIN:VEVENT' + veventBlock.split('END:VEVENT')[0] + 'END:VEVENT';
									const dtStartMatch = eventData.match(/DTSTART[^:]*:([^\r\n]+)/);
									const summaryMatch = eventData.match(/SUMMARY:([^\r\n]+)/);
									
									sampleEvents.push({
										objectIndex: i,
										eventIndex: j,
										dtStart: dtStartMatch ? dtStartMatch[1] : 'No DTSTART found',
										summary: summaryMatch ? summaryMatch[1] : 'No SUMMARY found',
										eventDataPreview: eventData.substring(0, 200) + '...'
									});
								}
							}

							// Выбрасываем ошибку когда события не найдены
							throw new NodeOperationError(
								this.getNode(),
								`No events found for ${targetDate.toDateString()}. Calendar: ${calendarUrl}, Objects found: ${calendarObjects.length}`,
								{
									itemIndex: i,
									description: 'События на указанную дату не найдены',
								}
							);
						}

					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`CalDAV request failed: ${(error as Error).message}`,
							{ itemIndex: i }
						);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
} 