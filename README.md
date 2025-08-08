# n8n-nodes-caldav-calendar

A simple n8n community node for working with CalDAV calendars.

[Install](#installation) | [Compatibility](#compatibility) | [Usage](#usage) | [Configuration](#configuration) | [Operations](#operations) | [Development](#development)

## 🚀 Features

- **Dynamic calendar loading** - automatically fetch available calendars from server
- **Smart calendar names** - display user-friendly names instead of technical paths  
- **Calendar type detection** - automatically identify calendar types (Events/Tasks/Calendar)
- **Get calendar events** for a specific date
- **Create new events** in calendar
- **Delete events** by UID
- **Connect to any CalDAV server** (Google Calendar, Apple iCloud, NextCloud, etc.)
- **Basic authentication** (username/password)
- **Proper error handling** - informative messages when no events found
- **ISO date formats** with timezone support
- **🤖 AI Tool support** - can be used as a tool in AI Agent node

## Installation

```bash
npm install n8n-nodes-caldav-calendar
```

Or via n8n UI:
1. Go to Settings > Community Nodes
2. Enter `n8n-nodes-caldav-calendar`
3. Click Install

## Compatibility

- **n8n version**: 0.190.0 or later
- **Node.js**: 18.10.0 or later
- **CalDAV servers**: RFC 4791 compliant servers

### Tested CalDAV Servers

| Server | Status | Notes |
|--------|--------|-------|
| Google Calendar | ✅ Working | Use app passwords |
| Apple iCloud | ✅ Working | Standard authentication |
| NextCloud | ✅ Working | Standard authentication |
| Yandex Calendar | ⚠️ Limited | Artificial 60s delays for WebDAV |

## Configuration

### Creating CalDAV API Credentials

1. In n8n, go to Credentials
2. Create new credentials of type "CalDAV API"
3. Fill in the fields:
   - **Server URL**: Your CalDAV server URL (e.g., `https://cal.example.com/caldav/`)
   - **Username**: Your username
   - **Password**: Your password

### Popular CalDAV Server URLs

#### Google Calendar
- Server URL: `https://apidata.googleusercontent.com/caldav/v2/`
- Use app password instead of main password

#### Apple iCloud
- Server URL: `https://caldav.icloud.com/`

#### NextCloud
- Server URL: `https://your-nextcloud.com/remote.php/dav/calendars/USERNAME/`

#### ⚠️ Yandex Calendar CalDAV (LIMITATIONS)
- Server URL: `https://caldav.yandex.ru/`
- **WARNING**: Yandex artificially slows down WebDAV operations (60 seconds per MB since 2021)
- **Symptoms**: frequent 504 timeouts, especially when creating/updating events
- **Recommendations**: 
  - Use only for reading events
  - Consider switching to Google Calendar or Nextcloud
  - Wait several minutes between retries on errors

## 📋 Usage

### Standard Workflow Usage

1. Add CalDAV node to your workflow
2. Select the created credentials
3. **Choose calendar from dropdown list** 📅 (automatically loaded from server)
4. Select date to get events
5. Execute workflow

### 🤖 Using as AI Tool

The CalDAV node supports usage as an AI Tool for AI Agent:

1. Add AI Agent node to your workflow
2. In Tools section, select CalDAV node
3. AI agent can independently query calendar events when users ask about plans, meetings, or events

**Example AI agent questions:**
- "What events do I have tomorrow?"
- "What's scheduled for this week?"  
- "Are there any meetings on Monday?"
- "Create a team meeting tomorrow at 3 PM"
- "Delete the event with UID xyz789"

## 📖 Operations

### Get Events
Retrieves calendar events for a specific date.

**Parameters:**
- `Calendar Name or ID` - select calendar from list
- `Date` - date to get events for (ISO 8601 format)

**Returns:** Array of events with fields `uid`, `summary`, `description`, `location`, `dtStart`, `dtEnd`, `url`, `etag`

### Create Event
Creates a new event in the calendar.

**Parameters:**
- `Calendar Name or ID` - select calendar from list  
- `Event Title` - event title (required)
- `Start Date and Time` - start date and time (required)
- `End Date and Time` - end date and time (required)
- `Description` - event description (optional)
- `Location` - event location (optional)

**Returns:** Created event object with `uid`, `title`, `startDateTime`, `endDateTime`, `description`, `location`, `url`, `etag`, `success`, `message`


### Delete Event
Deletes an existing event by UID.

**Parameters:**
- `Calendar Name or ID` - select calendar from list
- `Event UID` - unique event identifier to delete (required)

**Returns:** Object with deletion confirmation including `uid`, `url`, `success`, `message`, `deletedAt`

### ✨ New Features

- **Automatic calendar selection**: no more manual calendar path entry
- **User-friendly names**: instead of `/calendars/user/events-123/` shows `My Calendar (Events)`
- **Informative errors**: when no events found, node reports exact reason

## Example Output

```json
{
  "uid": "event-123@example.com",
  "summary": "Meeting with team",
  "description": "Weekly team meeting",
  "dtStart": "20241201T100000Z",
  "dtStartISO": "2024-12-01T10:00:00.000Z",
  "dtEnd": "20241201T110000Z", 
  "dtEndISO": "2024-12-01T11:00:00.000Z",
  "url": "https://cal.example.com/event/123",
  "etag": "\"123456789\"",
  "calendarData": "BEGIN:VCALENDAR..."
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Install test dependencies
npm install
```

Tests verify:
- Compiled node structure
- Package configuration
- Error handling
- Date and event parsing

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with hot reload
npm run dev

# Run tests
npm test
```

## 🔧 Release History

### v2.0.1
- ✅ **🤖 AI Tool support** - integration with AI Agent node
- ✅ **Improved compatibility** with modern n8n versions

### v1.0.3
- ✅ **Dynamic calendar loading** via `loadOptionsMethod`
- ✅ **Improved calendar names** with automatic type detection
- ✅ **Proper error handling** with `NodeOperationError`
- ✅ **Automated tests** with mocha
- ✅ **TypeScript support** and compilation

## API Reference

This node implements the CalDAV protocol as specified in [RFC 4791](https://tools.ietf.org/html/rfc4791).

### Supported CalDAV Operations
- `PROPFIND` - for calendar discovery
- `REPORT` - for event querying
- `PUT` - for event creation/updates
- `DELETE` - for event deletion

### Authentication
Currently supports HTTP Basic Authentication. OAuth support may be added in future versions.

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## Support

- [GitHub Issues](https://github.com/mediabc/n8n-nodes-caldav-calendar/issues)
- [CalDAV RFC 4791](https://tools.ietf.org/html/rfc4791)
- [n8n Community](https://community.n8n.io/) 