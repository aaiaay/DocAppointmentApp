import { version } from './version.js';

const week = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const IDB = (function init() {

    let container = document.getElementById('doctor-container-admin');
    let startDateInput = document.getElementById("input-startDate");
    let endDateInput = document.getElementById("input-endDate");

    let start, end;

    startDateInput.addEventListener('change', setStartDate);
    endDateInput.addEventListener('change', setEndDate);

    function setStartDate() {
        start = new Date(startDateInput.value);
        showPieChart();
        showLineChart();
    }

    function setEndDate() {
        end = new Date(endDateInput.value);
        showPieChart();
        showLineChart();
        showTable();
    }

    let db = null;
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
    });

    DbOpenReq.addEventListener('success', function(event) {
        db = event.target.result;

        setStartDate();
        setEndDate();
        showDoctorSelect();
    });

    function showDoctorSelect() {
        let doctorSelect = document.getElementById('doctor-select');

        let tx = makeTX('Doctors', 'readonly');

        let store = tx.objectStore('Doctors');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {
            let request = event.target; 

            doctorSelect.innerHTML = request.result.map(doctor => {
                return `<div class = "doctor-element" data-key = "${doctor.id}">${doctor.name}</div>`
            }).join('\n');
        }
        
        getReq.onerror = (error) => {
            console.warn(error);
        }
    }

    document.getElementById('doctor-select').addEventListener('click', (event) => { 

        if (!(document.getElementById('first-chart'))){
            let chart = document.createElement('DIV');
            let title = document.createElement('h3');
            title.id = 'firstChartTitle';
            chart.id = 'first-chart';
            chart.style = "width: 100%; height:500px;"

            let container = document.getElementById('main-container');
            let div = document.createElement('DIV');
            div.classList.add('statistics-block');

            div.insertAdjacentElement('afterbegin', chart);
            div.insertAdjacentElement('afterbegin', title);
            container.insertAdjacentElement('afterbegin', div)

        }

        let element = event.target.closest('DIV');
        if (!(element.tagName == 'DIV')) return;

        let id = element.getAttribute('data-key');

        showBarChart(id);
    })

    function showBarChart(key) {
        let data = new Array(12).fill(0);

        let tx = makeTX('Doctors', 'readonly');
        let store = tx.objectStore('Doctors');
        let req = store.get(key);

        req.onsuccess = (event) => {
            let doctor = event.target.result;
        
            doctor.statistics.forEach((value, key) => {
                data[key.getMonth()] += value;
            });

            createFirstChart(data, doctor.name);
        }

        req.onerror = (error) => {
            console.warn(error)
        }
    }

    function createFirstChart(data, doctor) {
        let firstChart = echarts.init(document.getElementById('first-chart'));
        document.getElementById('firstChartTitle').innerHTML = doctor + ", Количество записей за выбранный период";

        let period = months.slice(start.getMonth(), end.getMonth() + 1);
        data = data.slice(start.getMonth(), end.getMonth() + 1);

        let option = {
            color: ['#198754'],
            tooltip: {},
            legend: {
                data: ['Записи']
            },
            xAxis: {
                data: period
            },
            yAxis: {},
            series: [
            {
                name: 'Записей:',
                type: 'bar',
                data: data,
                barWidth: '20%'
            }
            ]
            };
        
        firstChart.setOption(option);
    }

    function showPieChart() {
        let tx = makeTX('Doctors', 'readonly');

        let store = tx.objectStore('Doctors');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {

            let data = event.target.result.map(doctor => {

                let statistics = Array.from(doctor.statistics).filter(stat => (stat[0] >= start && stat[0] <= end));

                let sum = 0;

                for (let stat of statistics) {
                    sum+=stat[1];
                }

                return {value: sum, name: doctor.name};
            })

            createSecondChart(data);
        }
        getReq.onerror = (error) => {
            console.warn(error)
        }
    }

    function createSecondChart(data) {
        let secondChart = echarts.init(document.getElementById('second-chart'));

        let option = {
            tooltip: {},
            series: [
              {
                type: 'pie',
                data: data
              }
            ]
          };
          secondChart.setOption(option);
    }

    function showLineChart() {
        let count = new Array();
        let tx = makeTX('Doctors', 'readonly');

        let store = tx.objectStore('Doctors');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {

            event.target.result.forEach(doctor => {
                doctor.statistics.forEach((value,key) => {
                    count[key.getMonth()] += value;
                })
            });

            createThirdChart(count);
        }

        getReq.onerror = (error) => {
            console.warn(error)
        }
    }

    function createThirdChart(data) {
        let thirdChart = echarts.init(document.getElementById('third-chart'));

        let period = months.slice(start.getMonth(), end.getMonth()+1);
        data = data.slice(start.getMonth(), end.getMonth()+1);

        let option = {
            color: ['#198754'],
            tooltip: {},
            xAxis: {
              data: period
            },
            yAxis: {},
            series: [
              {
                data: data,
                type: 'line',
                smooth: true
              }
            ]
          };
          thirdChart.setOption(option);
    }
    
    function makeTX(storeName, mode) {
        let tx = db.transaction(storeName, mode);
        return tx;
    }

    function showTable(){

        let data = [];
        let tx = makeTX('Doctors', 'readonly');

        let store = tx.objectStore('Doctors');
        let getReq = store.getAll();

        getReq.onsuccess = (event) => {
            event.target.result.forEach(doctor => {
                let weekdays = new Array(7).fill(0);
                let fullcount = 0; let workdays = doctor.statistics.size;
                doctor.statistics.forEach((value, key) => {
                    weekdays[key.getDay()]+=value;
                    fullcount += value;
                })

                let max = 0; let maxDay;

                weekdays.forEach(function (value, i) {
                    if (value > max) { max = value; maxDay = i;}
                });

                data.push({name: doctor.name, count: fullcount, days: workdays, busyDay: week[maxDay]})
            });
            console.log(data);

            createTable(data);
        }

        getReq.onerror = (error) => {
            console.warn(error)
        }
    };

    function createTable(data) {
        if (!(container.innerHTML == "")) return;

        const dataTable = {
            columnDefs: [
                { headerName: "ФИО", field: "name", resizable: false, flex: 1 },
                { headerName: "Всего записей", field: "count", resizable: false, width: 150, flex: 1},
                { headerName: "Рабочих дней", field: "days", resizable: false, width: 150, flex: 1 },
                { headerName: "Самый занятый день недели", field: "busyDay", resizable: false, width: 250, flex: 1},
            ],  
        };
        
        let dataGrid = agGrid.createGrid(container, dataTable);
        dataGrid.setGridOption("rowData", data);
    }
})();

