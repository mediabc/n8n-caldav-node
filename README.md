# n8n-caldav-node

Простейший n8n community node для работы с календарями по протоколу CalDAV.

## Возможности

- Получение событий календаря за указанную дату
- Подключение к любому CalDAV серверу (Google Calendar, Apple iCloud, NextCloud, и др.)
- Базовая аутентификация (username/password)

## Установка

```bash
npm install n8n-caldav-node
```

Или через UI n8n:
1. Перейдите в Settings > Community Nodes
2. Введите `n8n-caldav-node`
3. Нажмите Install

## Настройка

### Создание учетных данных CalDAV API

1. В n8n перейдите в Credentials
2. Создайте новые учетные данные типа "CalDAV API"
3. Заполните поля:
   - **Server URL**: URL вашего CalDAV сервера (например, `https://cal.example.com/caldav/`)
   - **Username**: ваше имя пользователя
   - **Password**: ваш пароль

### Популярные CalDAV серверы

#### Google Calendar
- Server URL: `https://apidata.googleusercontent.com/caldav/v2/`
- Используйте app password вместо основного пароля

#### Apple iCloud
- Server URL: `https://caldav.icloud.com/`

#### NextCloud
- Server URL: `https://your-nextcloud.com/remote.php/dav/calendars/USERNAME/`

## Использование

1. Добавьте CalDAV node в ваш workflow
2. Выберите созданные учетные данные
3. Укажите путь к календарю (например, `/calendars/user/personal/`)
4. Выберите дату для получения событий
5. Выполните workflow

## Пример вывода

```json
{
  "uid": "event-123@example.com",
  "summary": "Meeting with team",
  "description": "Weekly team meeting",
  "dtStart": "20241201T100000Z",
  "dtEnd": "20241201T110000Z",
  "url": "https://cal.example.com/event/123",
  "etag": "\"123456789\"",
  "calendarData": "BEGIN:VCALENDAR..."
}
```

## Разработка

```bash
# Установка зависимостей
npm install

# Сборка
npm run build

# Разработка с hot reload
npm run dev
```

## Лицензия

MIT 