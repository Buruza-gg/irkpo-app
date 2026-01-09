// server.js - УЛУЧШЕННАЯ ВЕРСИЯ
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https'); // Нужно для обхода проблем с SSL
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Базовый URL
const BASE_API = 'https://irkpo.ru/mtr/api';

// НАСТРОЙКА AXIOS (Маскируемся под браузер Chrome)
const apiClient = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://irkpo.ru/'
    },
    // Игнорируем ошибки SSL сертификата (частая проблема госсайтов)
    httpsAgent: new https.Agent({  
        rejectUnauthorized: false
    })
});

// --- ЭНДПОИНТЫ ---

app.post('/api/grades', async (req, res) => {
    try {
        const { phone } = req.body;
        console.log(`[LOG] Получен запрос оценок: ${phone}`);

        if (!phone) return res.status(400).json({ error: 'Пустой номер' });

        const digits = phone.replace(/\D/g, '');
        const cleanPhone = digits.slice(-10);

        if (cleanPhone.length !== 10) {
            return res.status(400).json({ error: 'Неверный формат номера' });
        }

        // Запрос к сайту
        const url = `${BASE_API}/student/${cleanPhone}`;
        console.log(`[LOG] Стучимся в API: ${url}`);
        
        const response = await apiClient.get(url);
        
        // Если пришел пустой ответ (студент не найден)
        if (!response.data) {
            return res.status(404).json({ error: 'Студент с таким номером не найден' });
        }

        console.log('[LOG] Успех! Данные получены.');
        res.json(response.data);

    } catch (error) {
        // Подробный вывод ошибки в консоль терминала
        console.error('[ERROR] Ошибка запроса:', error.message);
        if (error.response) {
            console.error('Статус удаленного сервера:', error.response.status);
            console.error('Данные ошибки:', error.response.data);
        }
        res.status(500).json({ error: 'Сервер колледжа не отвечает или данные недоступны' });
    }
});

app.post('/api/schedule', async (req, res) => {
    try {
        const { groupName } = req.body;
        console.log(`[LOG] Ищем группу: ${groupName}`);

        if (!groupName) return res.status(400).json({ error: 'Введите группу' });

        const encodedQuery = encodeURIComponent(groupName);
        
        // 1. Ищем ID
        const searchUrl = `${BASE_API}/schedule/find?query=${encodedQuery}`;
        const searchResponse = await apiClient.get(searchUrl);
        const groups = searchResponse.data;

        if (!groups || groups.length === 0) {
            return res.status(404).json({ error: 'Такая группа не найдена' });
        }

        const targetGroup = groups[0];
        console.log(`[LOG] Найдена группа: ${targetGroup.name} (ID: ${targetGroup.id})`);

        // 2. Берем расписание
        const scheduleUrl = `${BASE_API}/schedule?groupId=${targetGroup.id}`;
        const scheduleResponse = await apiClient.get(scheduleUrl);

        res.json({
            group: targetGroup.name,
            schedule: scheduleResponse.data
        });

    } catch (error) {
        console.error('[ERROR] Ошибка расписания:', error.message);
        res.status(500).json({ error: 'Не удалось загрузить расписание' });
    }
});

app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`Сервер работает!`);
    console.log(`ВАЖНО: Открой в браузере http://localhost:${PORT}`);
    console.log('--------------------------------------------------');
});