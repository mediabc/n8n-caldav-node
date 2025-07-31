# Установка CalDAV Node в n8n

## Способ 1: Локальная установка (для разработки)

1. Скопируйте папку `dist` в папку custom nodes n8n:
```bash
cp -r dist ~/.n8n/custom/
```

2. Перезапустите n8n:
```bash
n8n restart
```

3. CalDAV node появится в списке доступных nodes в категории "Community Nodes"

## Способ 2: Установка через npm (для продакшена)

1. Опубликуйте пакет в npm:
```bash
npm publish
```

2. В n8n перейдите в Settings > Community Nodes
3. Введите `n8n-nodes-caldav`
4. Нажмите Install

## Настройка учетных данных

1. В n8n перейдите в Credentials
2. Создайте новые учетные данные типа "CalDAV API"
3. Заполните поля:
   - **Server URL**: URL вашего CalDAV сервера
   - **Username**: ваше имя пользователя  
   - **Password**: ваш пароль

## Примеры серверов

### Google Calendar
- Server URL: `https://apidata.googleusercontent.com/caldav/v2/`
- Calendar URL: `/calendars/your-email@gmail.com/events/`

### NextCloud
- Server URL: `https://your-nextcloud.com/remote.php/dav/`
- Calendar URL: `/calendars/username/personal/`

### Apple iCloud
- Server URL: `https://caldav.icloud.com/`
- Calendar URL: `/calendars/username/`

## Использование

1. Добавьте CalDAV node в workflow
2. Выберите созданные учетные данные
3. Укажите путь к календарю
4. Выберите дату для получения событий
5. Запустите workflow

Node вернет массив событий с полями: `uid`, `summary`, `description`, `dtStart`, `dtEnd`, `url`, `etag`, `calendarData`. 