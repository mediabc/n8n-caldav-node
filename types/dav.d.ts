declare module 'dav' {
  export class Account {
    constructor(options: { server: string; xhr: any });
    server: string;
    xhr: any;
    calendars: Calendar[];
  }

  export class Credentials {
    constructor(options: { username: string; password: string });
    username: string;
    password: string;
  }

  export interface Calendar {
    url: string;
    displayName?: string;
    objects?: CalendarObject[];
  }

  export interface CalendarObject {
    url: string;
    etag: string;
    calendarData?: string;
  }

  export namespace transport {
    class Basic {
      constructor(credentials: Credentials);
      send(request: any, url: string, options?: any): Promise<any>;
    }
  }

  export function createAccount(options: {
    server: string;
    xhr: any;
    accountType: string;
    loadCollections?: boolean;
    loadObjects?: boolean;
  }): Promise<Account>;

  export function createCalendarObject(calendar: Calendar, options: { url: string }): Promise<CalendarObject>;
  export function syncCalendar(calendar: Calendar, options?: { xhr?: any; syncMethod?: string }): Promise<Calendar>;
} 