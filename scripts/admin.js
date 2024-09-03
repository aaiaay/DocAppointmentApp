import { uid, validateTime, createSpec, isTimeBetween, formSchedule, validateName } from './functions.js';
import { version } from './version.js';

let doctorContainer = document.getElementById('doctor-container-admin');
let patientContainer = document.getElementById('patient-container-admin')

let addDoctorBtn = document.getElementById('btn-add-doctor');

let addDoctorInput = document.getElementById('input-doctor');
let addStartTimeInput = document.getElementById('input-start-time');
let addEndTimeInput = document.getElementById('input-end-time');

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
        showDoctorTable();
    });

    const doctorGridOptions = {
        columnDefs: [
            { headerName: " ", field: "id", checkboxSelection: true, resizable: false, maxWidth: 48},
            { headerName: "ФИО", field: "name", editable: true, resizable: false, flex: 1 },
            { headerName: "Начало смены", field: "timeStart", editable: true, resizable: false, flex: 1},
            { headerName: "Конец смены", field: "timeEnd", editable: true, resizable: false, flex: 1 },
            { field: "statistics", hide: true, suppressToolPanel: true, resizable: false, flex: 1}
        ],  
        rowSelection: "multiple",
        onCellValueChanged: cellChangeDoctor, 
        onSelectionChanged: selectionChangeDoctor,
        suppressRowClickSelection: true
    };
    
    let docGrid = agGrid.createGrid(doctorContainer, doctorGridOptions);

    const patientGridOptions = {
        columnDefs: [
            { headerName: " ", field: "id", checkboxSelection: true, resizable: false, maxWidth: 48},
            { headerName: "ФИО", field: "name", editable: true, resizable: false, flex: 1 },
            { field: "specKey", hide: true, suppressToolPanel: true, resizable: false, flex: 1},
            { headerName: "Дата", field: "date", editable: true, resizable: false, flex: 1, valueFormatter: dateFormatter},
            { headerName: "Время", field: "time", editable: true, resizable: false, flex: 1},
            { headerName: "Специалист", field: "spec", editable: false, resizable: false, flex: 1},
        ],  
        rowSelection: "multiple",
        onCellValueChanged: cellChangePatient, 
        onSelectionChanged: selectionChangePatient,
        suppressRowClickSelection: true
    };
    
    function dateFormatter(params){
        console.log(params.value);
        let arr = params.value.split('-');
        let date = arr[2] + '.' + arr[1] + '.' + arr[0];
        return date;
    }

    let patGrid = agGrid.createGrid(patientContainer, patientGridOptions);

    addDoctorBtn.addEventListener('click', () => {
        let name = addDoctorInput.value;
        let timeStart = addStartTimeInput.value;
        let timeEnd = addEndTimeInput.value;

        if (!(checkData(name, timeStart, timeEnd))) return;

        let statistics = new Map();
        createStatistics(statistics);
    
        let doctor = {
            id: uid(),
            name, 
            timeStart,
            timeEnd,
            statistics,
        };
    
        let tx = makeTX('Doctors', 'readwrite');
    
        tx.oncomplete = () =>  {
            addDoctorInput.value = '';
            addStartTimeInput.value = '';
            addEndTimeInput.value = '';
            showDoctorTable();
        }
    
        tx.onerror = (err) => {
            console.warn(err);
        }
    
        let store = tx.objectStore('Doctors');
        let request = store.add(doctor);
    
        request.onsuccess = () => {
            console.log('Успешно добавлена запись в таблицу Doctors');
        }
    
        request.onerror = () => {
            console.log('Ошибка при добавлении записи в таблицу Doctors');
        }
    })


    function showDoctorTable() {
        let tx = makeTX('Doctors', 'readonly');

        let store = tx.objectStore('Doctors');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {
            let request = event.target; 
            let doctors = request.result;
          
            let rowData = doctors.map(doctor => {
                return { "id": doctor.id, "name": doctor.name, "timeStart": doctor.timeStart, "timeEnd": doctor.timeEnd, "statistics": doctor.statistics};
            });
            
            docGrid.setGridOption("rowData", rowData);
            showPatientTable();
        }

        getReq.onerror = (error) => {
            console.warn(error);
        }  
    }

    function showPatientTable() {
        let tx = makeTX('Patients', 'readonly');
        
        let store = tx.objectStore('Patients');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {
            let request = event.target; 
            let patients = request.result;
          
            let rowDataPromises = patients.map(patient => {
                return getDoctor(patient.specKey).then((doctor) => {
                    return { "id": patient.id, "name": patient.name,"specKey": patient.specKey, "date": patient.date, "time": patient.time, "spec": doctor.name};
                });
            });
    
            Promise.all(rowDataPromises).then(rowData => {
                patGrid.setGridOption("rowData", rowData);
            }).catch(error => {
                console.warn(error);
            });
        }

        getReq.onerror = (error) => {
            console.warn(error);
        }  
    }

    function cellChangeDoctor(params) {

        let newValue = params.newValue;
        let oldValue = params.oldValue;

        let column = params.column.colId;
        if (column == 'timeStart' || column == 'timeEnd') {
            if (!validateTime(newValue)) {
                params.newValue = oldValue;
                return;
            }
        }

        let changedData = [params.data];

        let tx = makeTX('Doctors', 'readwrite');

        let store = tx.objectStore('Doctors');
        let request = store.put(changedData[0]);
    
        request.onsuccess = () => {
            console.log('Успешно обновился объект в таблице Doctors');
        };
          
        request.onerror = () => {
            console.log('Ошибка при обновлении объекта в таблице Doctors');
        };
    }   

    function checkTimeAvailability(schedule, time) {
        return schedule.includes(time);
    }

    function cellChangePatient(params) {

        let newValue = params.newValue;
        let oldValue = params.oldValue;
        let column = params.column.colId;
    
        if (column === "time") {
            let timecheck = false;
    
            function checkTime() {
                return new Promise((resolve, reject) => {
                    if (!validateTime(newValue)) {
                        params.newValue = oldValue;
                        reject('Некорректное время');
                    } else {
                        resolve();
                    }
                });
            }
    
            function checkAppointment() {
                return new Promise((resolve, reject) => {
                    let date = params.data.date;
                    let spec = params.data.specKey;
    
                    let tx = makeTX('Patients', 'readonly');
                    let store = tx.objectStore('Patients');
    
                    let range = IDBKeyRange.only(newValue);
                    let idx = store.index('timeIDX');
                    let req = idx.openCursor(range);
    
                    req.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (cursor.value.date === date && cursor.value.specKey === spec) {
                                timecheck = true;
                                reject('Запись на такое время в такую дату уже есть');
                            }
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    }
    
                    req.onerror = (error) => {
                        console.warn(error)
                        reject(error);
                    }
                });
            }
    
            function checkExist() {
                return new Promise((resolve, reject) => {
                    let doctorPromise = getDoctor(params.data.specKey);
                    doctorPromise.then(doctor => {
                        if (!isTimeBetween(doctor.timeStart, doctor.timeEnd, newValue)) {
                            reject('Время выходит за пределы смены');
                        } else {
                            let schedule = formSchedule(doctor.timeStart, doctor.timeEnd, params.data.date);
                            if (!checkTimeAvailability(schedule, newValue)) {
                                reject('Нет доступного времени для записи');
                            } else {
                                resolve();
                            }
                        }
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
    
            checkTime()
                .then(() => checkAppointment())
                .then(() => checkExist())
                .then(() => {
                    if (!timecheck) {
                        update();
                    }
                })
                .catch((error) => {
                    console.error('Ошибка:', error);
                });
        }
    
        if (column === "date") {
            let datecheck = false;
    
            function checkAppointment() {
                return new Promise((resolve, reject) => {
                    let time = params.data.time;
                    let spec = params.data.specKey;
    
                    let tx = makeTX('Patients', 'readonly');
                    let store = tx.objectStore('Patients');
    
                    let range = IDBKeyRange.only(newValue);
                    let idx = store.index('dateIDX');
                    let req = idx.openCursor(range);
    
                    req.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (cursor.value.time === time && cursor.value.specKey === spec) {
                                datecheck = true;
                                reject('Запись на такую дату в такое время уже есть');
                            }
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    }
    
                    req.onerror = (error) => {
                        console.warn(error)
                        reject(error);
                    }
                });
            }
    
            checkAppointment()
                .then(() => {
                    if (!datecheck) {
                        update();
                    }
                })
                .catch((error) => {
                    console.error('Ошибка:', error);
                });
        }
    
        function update() {
            let changedData = [params.data];
            let tx = makeTX('Patients', 'readwrite');
            let store = tx.objectStore('Patients');
            let request = store.put(changedData[0]);
    
            request.onsuccess = () => {
                console.log('Успешно обновился объект в таблице Patients');
            };
    
            request.onerror = () => {
                console.log('Ошибка при обновлении объекта в таблице Patients');
            };
        }
    }
    
    
    function getDoctor(id) {
        return new Promise((resolve) => {
            let tx = makeTX('Doctors', 'readonly');

            let store = tx.objectStore('Doctors');
            let getReq = store.get(id);

            getReq.onsuccess = (event) => {
                let doctor = event.target.result;
                resolve(doctor);
            }  
            getReq.onerror = (error) => {
                console.warn(error);
            }
        }) 
    }

    document.getElementById("btn-auto-add-doctor").onclick = function() {
        addDoctorInput.value = createSpec().name;
        addStartTimeInput.value = createSpec().start;
        addEndTimeInput.value = createSpec().end;
    }

    function selectionChangeDoctor () {
        let selectedRows = docGrid.getSelectedRows();

        document.onkeydown = (event) => {
            if (event.key === 'Delete') {
             
                for (let row of selectedRows) {
                    let id = row.id;
                    let tx = makeTX('Doctors', 'readwrite');
    
                    tx.onerror = (err) => {
                        console.warn(err);
                    }
    
                    let store = tx.objectStore('Doctors');
                    let request = store.delete(row.id);
    
                    request.onsuccess = () => {
                        console.log('Успешно удалено')
                        deletePatients(id);
                    }
    
                    request.onerror = () => {
                        console.log('Ошибка при удалении')
                    }
                }
                showDoctorTable();
            }
        }
    }

    function deletePatients(id) {

        let tx = makeTX('Patients', 'readwrite');
        let store = tx.objectStore('Patients');

        tx.onerror = (err) => {
            console.warn(err);
        }

        let range = IDBKeyRange.only(id);
        let idx = store.index('specKeyIDX');
        let req = idx.openCursor(range);

        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                let request = store.delete(cursor.value.id);
                request.onsuccess = () => {
                    console.log('Удалена запись из таблицы Doctors, вместе с ней удалена запись из Patients')
                }

                request.onerror = () => {
                    console.log('Ошибка при удалении записи из Patients при удалении записи из Doctors')
                }
                cursor.continue();
            }
        }

        req.onerror = (error) => {
            console.warn(error)
        }
    }

    function selectionChangePatient () {
        let selectedRows = patGrid.getSelectedRows();

        document.onkeydown = (event) => {
            if (event.key === 'Delete') {
                for (let row of selectedRows) {
                    let tx = makeTX('Patients', 'readwrite');
    
                    tx.onerror = (err) => {
                        console.warn(err);
                    }
    
                    let store = tx.objectStore('Patients');
                    let request = store.delete(row.id);
    
                    request.onsuccess = () => {
                        console.log('Успешно удалена запись из таблицы Patients')
                    }
    
                    request.onerror = () => {
                        console.log('Ошибка при удалении записи из таблицы Patients')
                    }
                }
                showPatientTable();
        };
    }}

    function makeTX(storeName, mode) {
        let tx = db.transaction(storeName, mode);
        return tx;
    }

    function checkData (name, start, end) {
        if ((!name) || (!start) || (!end)) return false;
        if (!(validateTime(start)) || !(validateTime(end))) return false;
        if (!(validateName(name))) return false
       return true;
    }

    function createStatistics(statistics){
        let n = randomIntFromInterval(50, 250);
        let date, count;
        for (let i = 0; i < n; i++) {
            date = randomDate(new Date(2023, 0, 1), new Date(2023, 11, 30));
            count = randomNumber();

            statistics.set(date, count);
        }
    }

    function randomDate(start, end) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    function randomIntFromInterval(min, max) { 
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    function randomNumber() {
        let numbers = [1,2,3,4,5,6,7,8,9,10,11,11,12,12,13,13,14,14,15,15,16,16,16,17,17,17,18,18,18,19,19,19,20,20,20,21,21,21,21,22,22,22,22,23,23,23,23,24,24,24,24,25,25,26,27,28,29,30];
        return numbers[Math.floor(Math.random() * numbers.length)];
    }

})();


