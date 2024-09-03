import { uid, validateTime, formSchedule } from './functions.js';
import { version } from './version.js';

let doctorListContainer = document.getElementById('doctor-list-container');
let scheduleContainer = document.getElementById('schedule-container');

let doctorNameField = document.getElementById('doctor-name-field');
let dateField = document.getElementById('date-field');
let timeField = document.getElementById('time-field');

let patientInput = document.getElementById('input-patient');

let makeAppointmentBtn = document.getElementById('btn-make-appointment');
let showModalBtn = document.getElementById('btn-open-modal');

const IDB = (function init() {
    let db = null;
    let objectStore = null;
    let DbOpenReq = indexedDB.open('DB', version());

    DbOpenReq.addEventListener('error', function(err) {
        console.warn(err);
    });

    DbOpenReq.addEventListener('upgradeneeded', function(event) {
        db = event.target.result;
        let oldVersion = event.oldVersion;
        let newVersion = event.newVersion || db.version;
        console.log('DB перешла с версии ', oldVersion, 'на ', newVersion);

        if (!db.objectStoreNames.contains('Doctors')){
            objectStore = db.createObjectStore('Doctors', {
                keyPath: 'id',
            })
        }    

        if (!db.objectStoreNames.contains('Patients')){
            
            objectStore = db.createObjectStore('Patients', {
                keyPath: 'id',
            })

        objectStore.createIndex('specKeyIDX', 'specKey', {unique: false});
        objectStore.createIndex('timeIDX', 'time', {unique: false});
        objectStore.createIndex('dateIDX', 'date', {unique: false});
        }    
    });

    DbOpenReq.addEventListener('success', function(event) {
        db = event.target.result;
        console.log('Успешно открылась: ', db);
        showDoctorList();
    });

    function showDoctorList() {
        let list = document.getElementById('doctor-list');

        let tx = makeTX('Doctors', 'readonly');
        let store = tx.objectStore('Doctors');

        let getAllReq = store.getAll(); 

        getAllReq.onsuccess = (event) => {
            list.innerHTML = event.target.result.map(doctor => {
                return `<div class = "doctor-element" data-display = "false" data-key = "${doctor.id}"><input id="input-${doctor.id}" type="checkbox"><label class = "label" for="input-${doctor.id}">${doctor.name}</label></div>`
            }).join('\n');
        }
        
        getAllReq.onerror = (error) => {
            console.warn("Ошибка при загрузке списка специалистов:", error);
        }
    }

    function getDoctorsInfo(event) {
        let element = event.target.closest('DIV');
        if (!(element.tagName == 'DIV')) return;

        if (element.getAttribute('data-display') == "true") {
            document.getElementById('schedule' + element.getAttribute('data-key')).remove();
            element.setAttribute("data-display", "false");
            return;
        }
        
        if (!(element.querySelector('input').checked)) return;
        element.setAttribute("data-display", "true");

        let tx = makeTX('Doctors', 'readonly');
        let store = tx.objectStore('Doctors');

        let id = element.getAttribute('data-key');
        let req = store.get(id);

        req.onsuccess = (event) => {
            getPatientsInfo(event.target.result);
        }

        req.onerror = (error) => {
            console.warn(error)
        }
    }

    function getPatientsInfo(doctor) {
        let date = document.getElementById('input-datepicker').value;
        let patSchedule = [];
        
        let tx = makeTX('Patients', 'readonly');
        let store = tx.objectStore('Patients');

        let range = IDBKeyRange.only(doctor.id);
        let idx = store.index('specKeyIDX');
        let req = idx.openCursor(range);

        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.date == date) {
                    patSchedule.push({name: cursor.value.name, time: cursor.value.time});
                }
                cursor.continue();
            }
            else {
                showSchedule(doctor, date, patSchedule);
            }
        }

        req.onerror = (error) => {
            console.warn(error)
        }
    }
    
    doctorListContainer.onclick = getDoctorsInfo;

    function showSchedule(doctor, date, schedule) {
        let timeStart = doctor.timeStart;
        let timeEnd = doctor.timeEnd;
        let name = doctor.name;
     
        let scheduleBlock = document.createElement('div');
        scheduleBlock.classList.add('ag-theme-quartz');
        scheduleBlock.classList.add('grid-schedule');
        scheduleBlock.style = "width: 200px; height: 550px";
        scheduleBlock.id = 'schedule' + doctor.id;
     
        scheduleBlock.setAttribute('doctorName', name);
        scheduleBlock.setAttribute('selectedDate', date);
        scheduleBlock.classList.add('schedule-table');

        let timeStamps = formSchedule(timeStart, timeEnd, date).map(time => ({[name]: { time, patient: '' }}));

        for (let slot of schedule) {
            for (let timeStamp of timeStamps) {
                if (timeStamp[name] && timeStamp[name].time === slot.time) {
                    timeStamp[name].patient = slot.name;
                }
            }
        }

        let formatter = new Intl.DateTimeFormat("ru");
        date = formatter.format(new Date(date));

        const scheduleGridOptions = {
            columnDefs: [{
                headerName: date,
                field: date,
                children: [{
                    field: name,
                    headerName: name,
                    cellRenderer: function(params) {
                        if (params.value.patient) {
                            return params.value.patient;
                        } else {
                            return params.value.time;

                        }
                    },
                    cellStyle: function(params) {
                        if (params.value.patient) {
                            return {backgroundColor: '#C7F6C7'};
                        } else {
                            return null;
                        }
                    }
                }],
                suppressFieldDotNotation: true,
            }],
            suppressFieldDotNotation: true,
            rowSelection: "single",
        };
 
        let scedGrid = agGrid.createGrid(scheduleBlock, scheduleGridOptions);

        scedGrid.setGridOption("rowData", timeStamps);
        scheduleContainer.append(scheduleBlock);
    }

    scheduleContainer.onclick = addPatient;

    function addPatient (event) {

        let cell = event.target.closest('DIV'); 
        if (!(cell.getAttribute('role') == 'gridcell')) return;

        let table = event.target.closest('.schedule-table');
        if (!table) return;

        let allCells = document.querySelectorAll('[role="gridcell"]');
        allCells.forEach(cell => cell.classList.remove('selected-cell'));

        let time = cell.textContent;
        if (!validateTime(time)) {
            showModalBtn.setAttribute("data-bs-toggle", ""); 
            return;
        }
       
        let specKey = table.id.slice(8);

        cell.classList.add('selected-cell');
        if (time) showModalBtn.setAttribute("data-bs-toggle", "modal");

        showModalBtn.onclick = function() {

            patientInput.value = "";

            doctorNameField.innerHTML = "ФИО: " + table.getAttribute('doctorname');
            dateField.innerHTML = "Дата: " + table.getAttribute('selecteddate');
            timeField.innerHTML = "Время: " + time;

        }

        makeAppointmentBtn.onclick = function() {
            let name = patientInput.value;
            let date = dateField.innerHTML.split(" ")[1];
            let time = timeField.textContent.split(" ")[1];
    
            let patient = {
                id: uid(),
                name, 
                specKey,
                date,
                time,
            };
        
            let tx = makeTX('Patients', 'readwrite');
    
            tx.onerror = (err) => {
                console.warn(err);
            }
        
            let store = tx.objectStore('Patients');
            let request = store.add(patient);
        
            request.onsuccess = () => {
                cell.innerHTML = patient.name;
                cell.style.backgroundColor = '#C7F6C7';
                console.log('Запись пациента успешно добавлена');
            }
        
            request.onerror = () => {
                console.log('Ошибка при записи пациента');
            }
        }
    }

    function makeTX(storeName, mode) {
        let tx = db.transaction(storeName, mode);
        return tx;
    }
})();