import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import * as dav from 'dav';

export class Caldav implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CalDAV',
		name: 'caldav',
		icon: 'file:caldav.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with CalDAV calendars',
		defaults: {
			name: 'CalDAV',
		},
		inputs: ['main' as any],
		outputs: ['main' as any],
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
				displayName: 'Calendar URL',
				name: 'calendarUrl',
				type: 'string',
				default: '',
				placeholder: '/calendars/user/calendar-name/',
				description: 'Calendar path on the CalDAV server',
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



	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('caldavApi');

		// Локальная функция для проверки повторяющихся событий
		const isRecurringEventOnDate = (eventStartDate: Date, targetDate: Date, rrule: string): boolean => {
			// Если событие началось после целевой даты, оно не может повториться в прошлом
			if (eventStartDate > targetDate) {
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
				const untilDate = parseICalDate(rules['UNTIL']);
				if (untilDate && targetDate > untilDate) {
					return false;
				}
			}

			// Рассчитываем количество дней между событием и целевой датой
			const daysDiff = Math.floor((targetDate.getTime() - eventStartDate.getTime()) / (1000 * 60 * 60 * 24));

			switch (freq) {
				case 'DAILY':
					const interval = parseInt(rules['INTERVAL'] || '1');
					return daysDiff % interval === 0;

				case 'WEEKLY':
					if (daysDiff % 7 !== 0) return false;
					
					// Проверяем дни недели (BYDAY)
					if (rules['BYDAY']) {
						const allowedDays = rules['BYDAY'].split(',');
						const targetDayOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDate.getDay()];
						return allowedDays.includes(targetDayOfWeek);
					}
					
					const weekInterval = parseInt(rules['INTERVAL'] || '1');
					const weeksDiff = Math.floor(daysDiff / 7);
					return weeksDiff % weekInterval === 0;

				case 'MONTHLY':
					// Проверяем, что это тот же день месяца
					if (rules['BYMONTHDAY']) {
						const monthDay = parseInt(rules['BYMONTHDAY']);
						return targetDate.getDate() === monthDay;
					}
					
					// Базовая проверка - тот же день месяца, что и в оригинальном событии
					return targetDate.getDate() === eventStartDate.getDate();

				case 'YEARLY':
					// Проверяем, что это тот же день и месяц
					return targetDate.getDate() === eventStartDate.getDate() && 
						   targetDate.getMonth() === eventStartDate.getMonth();

				default:
					return false;
			}
		};

		// Локальная функция для парсинга дат iCalendar
		const parseICalDate = (dateStr: string): Date | null => {
			try {
				if (dateStr.length === 8) {
					// Формат YYYYMMDD
					const year = parseInt(dateStr.substring(0, 4));
					const month = parseInt(dateStr.substring(4, 6)) - 1;
					const day = parseInt(dateStr.substring(6, 8));
					return new Date(year, month, day);
				} else if (dateStr.includes('T')) {
					// Формат YYYYMMDDTHHMMSS
					const dateOnly = dateStr.substring(0, 8);
					const year = parseInt(dateOnly.substring(0, 4));
					const month = parseInt(dateOnly.substring(4, 6)) - 1;
					const day = parseInt(dateOnly.substring(6, 8));
					return new Date(year, month, day);
				}
			} catch (error) {
				return null;
			}
			return null;
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
						
						const calendar = account.calendars.find((cal: any) => 
							cal.url === fullCalendarUrl || cal.url.endsWith(calendarUrl)
						);

						if (!calendar) {
							throw new Error(`Calendar not found at URL: ${calendarUrl}. Available calendars: ${account.calendars.map((cal: any) => cal.url).join(', ')}`);
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
							const calendarWithObjects = accountWithObjects.calendars.find((cal: any) => 
								cal.url === calendar.url
							);
							
							if (calendarWithObjects && calendarWithObjects.objects) {
								calendarObjects = calendarWithObjects.objects;
							}
						}
						
						// Фильтруем события по дате
						const eventsForDate: any[] = [];
						
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
									let eventDate: Date;
									
									if (dateStr.includes('T')) {
										// Формат с временем YYYYMMDDTHHMMSS
										const dateOnly = dateStr.substring(0, 8);
										const eventYear = parseInt(dateOnly.substring(0, 4));
										const eventMonth = parseInt(dateOnly.substring(4, 6));
										const eventDay = parseInt(dateOnly.substring(6, 8));
										eventDate = new Date(eventYear, eventMonth - 1, eventDay);
									} else if (dateStr.includes('-')) {
										// Формат YYYY-MM-DD
										eventDate = new Date(dateStr);
									} else if (dateStr.length === 8) {
										// Формат YYYYMMDD
										const eventYear = parseInt(dateStr.substring(0, 4));
										const eventMonth = parseInt(dateStr.substring(4, 6));
										const eventDay = parseInt(dateStr.substring(6, 8));
										eventDate = new Date(eventYear, eventMonth - 1, eventDay);
									} else {
										continue;
									}
									
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
									if (rruleMatch && isRecurringEventOnDate(eventDate, targetDate, rruleMatch[1])) {
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

							const eventInfo = {
								uid: uidMatch ? uidMatch[1].trim() : '',
								summary: summaryMatch ? summaryMatch[1].trim() : '',
								description: descriptionMatch ? descriptionMatch[1].trim() : '',
								dtStart: dtStartMatch ? dtStartMatch[1].trim() : '',
								dtEnd: dtEndMatch ? dtEndMatch[1].trim() : '',
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
							const sampleEvents: any[] = [];
							
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

							returnData.push({
								json: {
									message: `No events found for ${targetDate.toDateString()}`,
									date: date,
									calendarUrl: calendarUrl,
									totalObjectsFound: calendarObjects.length,
									searchedDate: targetDate.toISOString(),
									targetDateString: targetDate.toDateString(),
									debug: {
										serverUrl: credentials.serverUrl,
										foundCalendars: account.calendars.length,
										selectedCalendarUrl: calendar.url,
										sampleEvents: sampleEvents
									}
								},
								pairedItem: {
									item: i,
								},
							});
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