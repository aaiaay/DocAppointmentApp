export const uid = () => {
    let time = Date.now().toString(36).toLocaleUpperCase();
    let rand = parseInt(Math.random() * Number.MAX_SAFE_INTEGER);
    rand = rand.toString(36).slice(0,12).padStart(12, '0').toLocaleUpperCase();
    return ''.concat(time, '-', rand);
};

export const validateTime = (time) => {
    time = time.split(":");
    if (time.length != 2) return false;
    let minutes = +time[1]; let hours = +time[0];
    if (isNaN(minutes) || isNaN(hours)) return false;
    if ((hours > 23 || hours < 0) || (minutes > 59 || minutes < 0)) return false;
    return true;
};

export const validateDate = (date) => {
    return !isNaN(new Date(date));
};

export const isTimeBetween = (startTime, endTime, time) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const timeMinutes = timeToMinutes(time);

    return startMinutes <= timeMinutes && timeMinutes <= endMinutes;
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

export const formSchedule = (start, end, date) => {
    date = new Date(date);
    let splitStart = start.split(":");
    let splitEnd = end.split(":");

    start = date.setHours(splitStart[0], splitStart[1])
    end = date.setHours(splitEnd[0], splitEnd[1]);
   
    let step = 10 * 60 * 1000;

    let timeStamps = [];
    let result = [];

    for (let ts = start; ts <= end; ts += step) {
        timeStamps.push(ts);
    }
      
    for (let i = 0; i < timeStamps.length; i++){
        timeStamps[i] = new Date(timeStamps[i]);
        let time = '';
        time += timeStamps[i].getHours() + ':';
        let minutes = timeStamps[i].getMinutes().toString(); 
        if (minutes.length == 1) minutes = '0' + minutes;
        time += minutes;
        result.push(time);
    }
    
    return result;
}

const lastNames = ['Иванова', 'Иванов', 'Сидоров', 'Сидорова', 'Петров', 'Петрова', 'Павлов', 'Павлова', 'Макаренко', 'Семенов', 'Семенова', 'Макарова', 'Макаров', 'Воробьева', 'Воробьев', 'Соловьева', 'Соловьев', 'Соколова','Соколов', 'Котова', 'Котов', 'Шилов', 'Шилова','Сидоренко', 'Ковалев', 'Ковалева', 'Коваленко', 'Павленко', 'Васильев', 'Васильева', 'Пономарев', 'Пономарева', 'Михайлов', 'Михайлова','Карпов', 'Карпова'];

const initials = ['А.Б.','А.В.','А.К.','Б.А.','Б.Л.','В.А.','В.В','В.Л.','Е.А.','Е.В.','Е.Н.','Е.М.','И.А.','И.В.','И.Е.','И.К','К.А.','К.М.','К.В.','К.Р.','Л.А.','Л.В.','Л.Н.','Н.А.','Н.Н.','Н.Д.','Н.В.','Н.С.','Н.В.','М.С.','М.В.','М.А.','С.С.','С.К.','С.В.','С.А.','Р.В.'];

const startTime = ["8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
const endTime = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];

export const createSpec = () => {
    let spec = {
        name: lastNames[Math.floor(Math.random() * lastNames.length)] + " " + initials[Math.floor(Math.random() * initials.length)],
        start: startTime[Math.floor(Math.random() * startTime.length)],
        end: endTime[Math.floor(Math.random() * endTime.length)],
    }   
    return spec;
}

export const checkName = (name) => {
    name = name.split(" ");
    console.log(name.length);

    if ((name.length != 2) && (name.length != 3)) { 
        return false;
    }

    let regex = /^[а-яА-Я]+$/;
    if (!(regex.test(name[0]))) return false;
    if (!(regex.test(name[1]))) return false;

    return true;
}

export const validateName = (name) => {
    name = name.split(" ");

    if ((name.length != 2)) { 
        return false;
    }

    let regex = /^[а-яА-Я.]+$/;
    if (!(regex.test(name[0]))) return false;
    if (!(regex.test(name[1]))) return false;

    return true;
}