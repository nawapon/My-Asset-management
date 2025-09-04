// public/app.js (Complete Version with All Features)

$(document).ready(function() {
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★  สำคัญ! สำหรับการทดสอบสแกน QR Code ด้วยมือถือ       ★
    // ★  ให้ใส่ Local IP Address ของคอมพิวเตอร์คุณตรงนี้      ★
    // ★  ตัวอย่าง: const SERVER_IP_FOR_QR_CODE = '192.168.1.34'; ★
    // ★  ถ้าไม่ใส่ เว็บจะใช้ localhost ตามปกติ                  ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    const SERVER_IP_FOR_QR_CODE = '10.67.3.116';

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    const baseUrl = SERVER_IP_FOR_QR_CODE 
        ? `http://${SERVER_IP_FOR_QR_CODE}:3000` 
        : window.location.origin;

    // Lightbox Initializer (for clickable QR codes)
    $(document).on('click', '[data-toggle="lightbox"]', function(event) {
        event.preventDefault();
        const $link = $(this);
        const title = $link.data('title');
        const qrUrl = $link.find('.qr-code-container').data('qr-url');

        // Create a temporary hidden div to generate the large QR code
        const $tempDiv = $('<div></div>').hide();
        $('body').append($tempDiv);

        new QRCode($tempDiv[0], {
            text: qrUrl,
            width: 400, // Larger size for lightbox
            height: 400,
            correctLevel: QRCode.CorrectLevel.H
        });

        // Use a short delay to ensure the image is rendered before getting its src
        setTimeout(() => {
            const largeQrSrc = $tempDiv.find('img').attr('src');
            $tempDiv.remove(); // Clean up the temporary div
            
            // Manually set href and trigger Ekko Lightbox
            $link.attr('href', largeQrSrc); 
            $(this).ekkoLightbox({
                alwaysShowClose: true,
                title: title
            });
        }, 150);
    });


    // Helper function for displaying messages
    function displayMessage(element, message, isSuccess) {
        const alertClass = isSuccess ? 'alert alert-success' : 'alert alert-danger';
        element.text(message).removeClass('alert-success alert-danger').addClass(alertClass).show();
        setTimeout(() => element.hide().text(''), 4000);
    }

    // Helper function for duration calculation
    function formatDuration(start, end) {
        if (!start || !end) return '-';
        const diff = new Date(end) - new Date(start);
        if (diff < 0) return '-';
        let seconds = Math.floor(diff / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 24);
        hours %= 24;
        minutes %= 60;
        let result = '';
        if (days > 0) result += `${days} วัน `;
        if (hours > 0) result += `${hours} ชม. `;
        if (minutes > 0) result += `${minutes} นาที`;
        return result.trim() || 'ทันที';
    }
    
    function formatDateTime(isoString) {
        if (!isoString) return '-';
        try {
            const date = new Date(isoString);
            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
            return date.toLocaleDateString('th-TH', options);
        } catch (e) {
            return '-';
        }
    }

    // --- Login Page Logic ---
    if ($('body.login-page').length) {
        $('#loginForm').on('submit', function(e) {
            e.preventDefault();
            const username = $('#username').val();
            const password = $('#password').val();
            const $message = $('#message');
            $.ajax({
                url: '/api/login', method: 'POST', contentType: 'application/json',
                data: JSON.stringify({ username, password }),
                success: function(data) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    displayMessage($message, 'เข้าสู่ระบบสำเร็จ!', true);
                    setTimeout(() => {
                        switch (data.user.role) {
                            case 'admin': window.location.href = '/admin-dashboard.html'; break;
                            case 'technician': window.location.href = '/tech-dashboard.html'; break;
                            default: window.location.href = '/user-dashboard.html'; break;
                        }
                    }, 1000);
                },
                error: function(jqXHR) {
                    const errorMsg = jqXHR.responseJSON ? jqXHR.responseJSON.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
                    displayMessage($message, errorMsg, false);
                }
            });
        });
    }

    // --- Register Page Logic ---
    if ($('body.register-page').length) {
        $('#registerForm').on('submit', function(e) {
            e.preventDefault();
            const fullName = $('#fullName').val();
            const username = $('#username').val();
            const password = $('#password').val();
            const confirmPassword = $('#confirmPassword').val();
            const $message = $('#message');
            if (password !== confirmPassword) {
                displayMessage($message, 'รหัสผ่านไม่ตรงกัน', false);
                return;
            }
            $.ajax({
                url: '/api/register', method: 'POST', contentType: 'application/json',
                data: JSON.stringify({ fullName, username, password }),
                success: function(data) {
                    displayMessage($message, 'สมัครสมาชิกสำเร็จ! กำลังไปหน้า Login...', true);
                    setTimeout(() => { window.location.href = '/index.html'; }, 2000);
                },
                error: function(jqXHR) {
                    const errorMsg = jqXHR.responseJSON ? jqXHR.responseJSON.message : 'เกิดข้อผิดพลาด';
                    displayMessage($message, errorMsg, false);
                }
            });
        });
    }

    // --- General Dashboard Logic (Logout, Welcome Message, Sidebar) ---
    if ($('body.sidebar-mini').length) {
        if (!token || !user) {
            window.location.href = '/index.html';
            return;
        }
        $('#welcomeMessage').text(`ยินดีต้อนรับ, ${user.fullName || user.username}`);
        $('#logoutButton').on('click', () => {
            localStorage.clear();
            window.location.href = '/index.html';
        });
        $('.nav-sidebar .nav-link').on('click', function(e) {
            e.preventDefault();
            $('.nav-sidebar .nav-link').removeClass('active');
            $(this).addClass('active');
            $('.content-section').removeClass('active');
            $($(this).data('target')).addClass('active');
        });
    }
    
    // --- User Dashboard Page Logic ---
    if ($('body.user-page').length) {
        let userCurrentSearchTerm = '';
        const $userEquipmentTableBody = $('#userEquipmentTableBody');
        const $userResetSearchBtn = $('#userResetSearchBtn');
        let modalTrigger = null;

        $('#userSearchForm').on('submit', function(e) {
            e.preventDefault();
            userCurrentSearchTerm = $('#userSearchInput').val();
            $userResetSearchBtn.toggle(!!userCurrentSearchTerm);
            fetchUserEquipment(1);
        });

        $userResetSearchBtn.on('click', function() {
            $('#userSearchInput').val('');
            userCurrentSearchTerm = '';
            fetchUserEquipment(1);
            $(this).hide();
        });

        const fetchUserEquipment = (page = 1) => {
            const limit = 10;
            const url = `/api/equipment?page=${page}&limit=${limit}&search=${encodeURIComponent(userCurrentSearchTerm)}`;
            $.ajax({
                url: url, method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(result) {
                    $userEquipmentTableBody.empty();
                    result.data.forEach(item => {
                        const statusBadge = {"Normal": "badge-success", "In Repair": "badge-warning", "Disposed": "badge-danger"};
                        $userEquipmentTableBody.append(`
                            <tr>
                                <td>${item.assetNumber}</td>
                                <td>${item.name}</td>
                                <td>${item.location || ''}</td>
                                <td><span class="badge ${statusBadge[item.status] || 'badge-secondary'}">${item.status}</span></td>
                                <td class="text-right">
                                    <button class="btn btn-primary btn-sm details-btn" data-assetnumber="${item.assetNumber}"><i class="fas fa-eye"></i> ดูรายละเอียด</button>
                                </td>
                            </tr>`);
                    });
                    renderUserPagination(result.pagination);
                }
            });
        };
        
        const renderUserPagination = (pagination) => {
            const { page, totalPages } = pagination;
            const $paginationControls = $('#userPaginationControls').empty().append('<ul class="pagination pagination-sm m-0 float-right"></ul>');
            if (totalPages <= 1) return;
            const $ul = $paginationControls.find('ul');
            const pages = new Set([1, totalPages]);
            if (page > 2) pages.add(page - 1);
            pages.add(page);
            if (page < totalPages - 1) pages.add(page + 1);
            const sortedPages = Array.from(pages).sort((a,b)=>a-b);
            let lastPage = 0;
            $ul.append(`<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page - 1}">&laquo;</a></li>`);
            sortedPages.forEach(p => {
                if (lastPage !== 0 && p > lastPage + 1) $ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>');
                $ul.append(`<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`);
                lastPage = p;
            });
            $ul.append(`<li class="page-item ${page === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page + 1}">&raquo;</a></li>`);
        };

        $('#userPaginationControls').on('click', 'a.page-link', function(e) {
            e.preventDefault();
            if (!$(this).parent().hasClass('disabled')) fetchUserEquipment($(this).data('page'));
        });

        $userEquipmentTableBody.on('click', '.details-btn', function(e) {
            modalTrigger = e.currentTarget;
            const assetNumber = $(this).data('assetnumber');
            $.ajax({
                url: `/api/equipment/history/${assetNumber}`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(response) {
                    const { details, history } = response;
                    $('#detailsModalTitle').text(`รายละเอียดครุภัณฑ์: ${details.assetNumber}`);
                    $('#detailsAssetNumber').text(details.assetNumber);
                    $('#detailsAssetName').text(details.name);
                    $('#detailsAssetType').text(details.type || '-');
                    $('#detailsAssetLocation').text(details.location || '-');
                    const statusBadge = {"Normal": "badge-success", "In Repair": "badge-warning", "Disposed": "badge-danger"};
                    $('#detailsAssetStatus').html(`<span class="badge ${statusBadge[details.status] || 'badge-secondary'}">${details.status}</span>`);
                    const $historyBody = $('#detailsHistoryTableBody').empty();
                    if (history.length > 0) {
                        history.forEach(item => {
                            $historyBody.append(`<tr>
                                <td>${formatDateTime(item.requestDate)}</td>
                                <td>${item.requestUser}</td>
                                <td>${item.problemDescription}</td>
                                <td>${formatDateTime(item.acceptedDate)}</td>
                                <td>${formatDateTime(item.completedDate)}</td>
                                <td><span class="badge badge-info">${item.status}</span></td>
                            </tr>`);
                        });
                    } else {
                        $historyBody.append('<tr><td colspan="6" class="text-center">ไม่พบประวัติการซ่อม</td></tr>');
                    }
                    const $qrContainer = $('#detailsModalQrCode').empty();
                    const qrUrl = `${baseUrl}/scan-and-repair.html?asset=${assetNumber}`;
                    new QRCode($qrContainer[0], { text: qrUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.H });
                    $('#detailsModal').modal('show');
                }
            });
        });

        $('.modal').on('hidden.bs.modal', function () {
            if (modalTrigger) {
                $(modalTrigger).focus();
                modalTrigger = null;
            }
        });

        const $myRepairsTableBody = $('#myRepairsTableBody');
        const fetchMyRepairs = () => {
             $.ajax({
                url: '/api/repairs', method: 'GET', headers: { 'Authorization': `Bearer ${token}` },
                success: function(repairs) {
                    $myRepairsTableBody.empty();
                    repairs.forEach(r => {
                        const statusBadge = {"Pending": "badge-warning", "In Progress": "badge-primary", "Completed": "badge-success"};
                        $myRepairsTableBody.append(`<tr><td>${r.assetNumber}</td><td>${r.problemDescription}</td><td>${new Date(r.requestDate).toLocaleDateString('th-TH')}</td><td><span class="badge ${statusBadge[r.status] || 'badge-secondary'}">${r.status}</span></td></tr>`);
                    });
                }
            });
        };

        $('#newRepairRequestForm').on('submit', function(e) {
            e.preventDefault();
            const assetNumber = $('#assetNumber').val();
            const problemDescription = $('#problemDescription').val();
            const reporterLocation = $('#reporterLocation').val();
            const reporterContact = $('#reporterContact').val();
            $.ajax({
                url: '/api/repairs', method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json',
                data: JSON.stringify({ assetNumber, problemDescription, reporterLocation, reporterContact }),
                success: function() {
                    displayMessage($('#formMessage'), 'แจ้งซ่อมสำเร็จ!', true);
                    $('#newRepairRequestForm')[0].reset();
                    $('#equipmentDetails').slideUp();
                    fetchMyRepairs();
                },
                error: function(jqXHR) {
                    displayMessage($('#formMessage'), jqXHR.responseJSON.message, false);
                }
            });
        });
        
        const $assetNumberInput = $('#assetNumber');
        const $equipmentDetails = $('#equipmentDetails');
        let debounceTimeout;
        $assetNumberInput.on('keyup', function() {
            clearTimeout(debounceTimeout);
            const assetNumber = $(this).val().trim();
            if (assetNumber.length > 5) {
                debounceTimeout = setTimeout(() => {
                    $.ajax({
                        url: `/api/equipment/details/${assetNumber}`,
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` },
                        success: function(details) {
                            if (details && details.name) {
                                $('#equipmentName').text(`ชื่ออุปกรณ์: ${details.name}`);
                                $('#equipmentLocation').text(`สถานที่: ${details.location || '-'}`);
                                $equipmentDetails.slideDown();
                            } else { $equipmentDetails.slideUp(); }
                        },
                        error: function() { $equipmentDetails.slideUp(); }
                    });
                }, 500);
            } else { $equipmentDetails.slideUp(); }
        });
        
        fetchUserEquipment();
        fetchMyRepairs();
    }

    // --- Tech Dashboard Page Logic ---
    if ($('body.tech-page').length) {
        const $techRepairModal = $('#techRepairModal');
        let modalTrigger = null;
        
        const fetchAndRenderQueue = () => {
            const $pendingCol = $('#pending-column').empty();
            const $inprogressCol = $('#inprogress-column').empty();
            const $completedCol = $('#completed-column').empty();

            $.ajax({
                url: '/api/repairs', method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(repairs) {
                    repairs.forEach(r => {
                        const contactInfo = `${r.reporterLocation || ''} (${r.reporterContact || '-'})`;
                        const card = `
                            <div class="kanban-card manage-repair-btn" data-id="${r.id}">
                                <div class="kanban-card-title">${r.assetNumber}</div>
                                <div class="kanban-card-meta">
                                    <span><i class="far fa-user"></i> ${r.requestUser}</span><br>
                                    <span><i class="far fa-building"></i> ${contactInfo}</span><br>
                                    <span><i class="far fa-calendar-alt"></i> ${formatDateTime(r.requestDate)}</span>
                                </div>
                                <p class="kanban-card-problem">${r.problemDescription}</p>
                            </div>
                        `;
                        if (r.status === 'Pending') $pendingCol.append(card);
                        else if (r.status === 'In Progress') $inprogressCol.append(card);
                        else if (r.status === 'Completed') $completedCol.append(card);
                    });
                }
            });
        };

        $('.content-wrapper').on('click', '.manage-repair-btn', function(e) {
            modalTrigger = e.currentTarget;
            const repairId = $(this).data('id');
            $.ajax({
                url: `/api/repairs/${repairId}`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(data) {
                    $('#repairId').val(data.id);
                    $('#modalAssetNumber').text(data.assetNumber);
                    $('#modalRequestUser').text(data.requestUser);
                    $('#modalContactInfo').text(`${data.reporterLocation || ''} (${data.reporterContact || '-'})`);
                    $('#modalProblem').text(data.problemDescription);
                    $('#modalRequestDate').text(formatDateTime(data.requestDate));
                    $('#solutionNotes').val(data.solutionNotes || '');
                    $('#modalStatus').val(data.status);
                    $techRepairModal.modal('show');
                }
            });
        });

        $('#techRepairForm').on('submit', function(e) {
            e.preventDefault();
            const repairId = $('#repairId').val();
            const newStatus = $('#modalStatus').val();
            const solutionNotes = $('#solutionNotes').val();
            $.ajax({
                url: `/api/repairs/${repairId}`, method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json',
                data: JSON.stringify({ status: newStatus, solutionNotes: solutionNotes }),
                success: function() {
                    $techRepairModal.modal('hide');
                    alert('บันทึกการเปลี่ยนแปลงสำเร็จ!');
                    fetchAndRenderQueue();
                },
                error: function() { alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล'); }
            });
        });

        $('.modal').on('hidden.bs.modal', function () {
            if (modalTrigger) {
                $(modalTrigger).focus();
                modalTrigger = null;
            }
        });
        
        fetchAndRenderQueue();
    }
    
    // --- Admin Dashboard Logic ---
    if ($('body.admin-page').length) {
        let currentSearchTerm = '';
        const $equipmentTableBody = $('#equipmentTableBody');
        const $equipmentModal = $('#equipmentModal');
        const $resetSearchBtn = $('#resetSearchBtn');
        let modalTrigger = null; 

        let statusChartInstance = null;
        let typeBarChartInstance = null;
        let typePieChartInstance = null;
        let avgTimeChartInstance = null;

        const fetchDashboardData = () => {
            $.ajax({
                url: '/api/equipment/summary',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(summary) {
                    $('#total-assets').text(summary.total || 0);
                    $('#normal-status').text(summary.byStatus.find(s => s.status === 'Normal')?.count || 0);
                    $('#repair-status').text(summary.byStatus.find(s => s.status === 'In Repair')?.count || 0);
                    $('#disposed-status').text(summary.byStatus.find(s => s.status === 'Disposed')?.count || 0);
                    $('#avg-response-time').text(formatDuration(0, (summary.timeSummary.avgResponseSeconds || 0) * 1000));
                    $('#avg-resolution-time').text(formatDuration(0, (summary.timeSummary.avgResolutionSeconds || 0) * 1000));

                    const statusCtx = document.getElementById('statusChart');
                    if (statusChartInstance) statusChartInstance.destroy();
                    statusChartInstance = new Chart(statusCtx, {
                        type: 'pie',
                        data: {
                            labels: summary.byStatus.map(s => s.status),
                            datasets: [{
                                data: summary.byStatus.map(s => s.count),
                                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8'],
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });

                    const typeBarCtx = document.getElementById('typeChart');
                    if (typeBarChartInstance) typeBarChartInstance.destroy();
                    typeBarChartInstance = new Chart(typeBarCtx, {
                        type: 'bar',
                        data: {
                            labels: summary.byType.slice(0, 5).map(t => t.type),
                            datasets: [{
                                label: 'จำนวน',
                                data: summary.byType.slice(0, 5).map(t => t.count),
                                backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true } },
                            plugins: { legend: { display: false } }
                        }
                    });
                    
                    const equipmentTypeCtx = document.getElementById('equipmentTypeChart');
                    if (typePieChartInstance) typePieChartInstance.destroy();
                    typePieChartInstance = new Chart(equipmentTypeCtx, {
                        type: 'pie',
                        data: {
                            labels: summary.byType.map(t => t.type),
                            datasets: [{
                                data: summary.byType.map(t => t.count),
                                backgroundColor: [
                                    '#3c8dbc', '#00c0ef', '#00a65a', '#f39c12', '#f56954', '#d2d6de',
                                    '#605ca8', '#ff851b', '#01ff70', '#39cccc', '#3d9970', '#001f3f'
                                ],
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                    
                    const avgTimeCtx = document.getElementById('avgTimeChart');
                    if (avgTimeChartInstance) avgTimeChartInstance.destroy();
                    avgTimeChartInstance = new Chart(avgTimeCtx, {
                        type: 'bar',
                        data: {
                            labels: summary.timeByType.map(t => t.type),
                            datasets: [{
                                label: 'เวลาซ่อมเฉลี่ย (ชั่วโมง)',
                                data: summary.timeByType.map(t => (t.avgResolutionSeconds / 3600).toFixed(2)),
                                backgroundColor: 'rgba(110, 68, 191, 0.7)',
                                borderColor: 'rgba(110, 68, 191, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            indexAxis: 'y',
                            scales: { x: { beginAtZero: true, title: { display: true, text: 'ชั่วโมง' } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            });
        };

        $('#searchForm').on('submit', function(e) {
            e.preventDefault();
            currentSearchTerm = $('#searchInput').val();
            $resetSearchBtn.toggle(!!currentSearchTerm);
            fetchEquipment(1);
        });

        $resetSearchBtn.on('click', function() {
            $('#searchInput').val('');
            currentSearchTerm = '';
            fetchEquipment(1);
            $(this).hide();
        });
        
        const fetchEquipment = (page = 1) => {
            const limit = 10;
            const url = `/api/equipment?page=${page}&limit=${limit}&search=${encodeURIComponent(currentSearchTerm)}`;
            $.ajax({
                url: url, method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(result) {
                    window.equipmentData = result.data;
                    $equipmentTableBody.empty();
                    result.data.forEach(item => {
                        const qrUrl = `${baseUrl}/scan-and-repair.html?asset=${item.assetNumber}`;
                        const row = `
                            <tr>
                                <td>
                                    <a href="#" data-toggle="lightbox" data-title="QR Code: ${item.assetNumber}">
                                        <div id="qr-container-${item.id}" class="qr-code-container" data-qr-url="${qrUrl}"></div>
                                    </a>
                                </td>
                                <td>${item.assetNumber}</td>
                                <td>${item.name}</td>
                                <td>${item.type || ''}</td>
                                <td>${item.location || ''}</td>
                                <td>${item.status}</td>
                                <td class="action-cell-admin">
                                    <button class="btn btn-primary btn-sm details-btn" data-assetnumber="${item.assetNumber}" title="ดูรายละเอียด"><i class="fas fa-eye"></i></button>
                                    <button class="btn btn-warning btn-sm edit-btn" data-id="${item.id}" title="แก้ไข"><i class="fas fa-pencil-alt"></i></button>
                                    <button class="btn btn-danger btn-sm delete-btn" data-id="${item.id}" title="ลบ"><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>`;
                        const $row = $(row);
                        $equipmentTableBody.append($row);
                        
                        if (typeof QRCode !== 'undefined') {
                            new QRCode($row.find('.qr-code-container')[0], { text: qrUrl, width: 45, height: 45, correctLevel: QRCode.CorrectLevel.H });
                        }
                    });
                    renderPagination(result.pagination);
                }
            });
        };
        
        const renderPagination = (pagination) => {
            const { page, totalPages } = pagination;
            const $paginationControls = $('#pagination-controls').empty().append('<ul class="pagination pagination-sm m-0 float-right"></ul>');
            if (totalPages <= 1) return;
            const $ul = $paginationControls.find('ul');
            const pages = new Set([1, totalPages]);
            if (page > 2) pages.add(page - 1);
            pages.add(page);
            if (page < totalPages - 1) pages.add(page + 1);
            const sortedPages = Array.from(pages).sort((a,b)=>a-b);
            let lastPage = 0;
            $ul.append(`<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page - 1}">&laquo;</a></li>`);
            sortedPages.forEach(p => {
                if (lastPage !== 0 && p > lastPage + 1) $ul.append('<li class="page-item disabled"><span class="page-link">…</span></li>');
                $ul.append(`<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`);
                lastPage = p;
            });
            $ul.append(`<li class="page-item ${page === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page + 1}">&raquo;</a></li>`);
        };

        $('#pagination-controls').on('click', 'a.page-link', function(e) {
            e.preventDefault();
            if (!$(this).parent().hasClass('disabled')) fetchEquipment($(this).data('page'));
        });
        
        $equipmentTableBody.on('click', 'button', function(e) {
            const $btn = $(this);
            modalTrigger = e.currentTarget;
            if ($btn.hasClass('details-btn')) {
                const assetNumber = $(this).data('assetnumber');
                $.ajax({
                    url: `/api/equipment/history/${assetNumber}`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` },
                    success: function(response) {
                        const { details, history } = response;
                        $('#detailsModalTitle').text(`รายละเอียดครุภัณฑ์: ${details.assetNumber}`);
                        $('#detailsAssetNumber').text(details.assetNumber);
                        $('#detailsAssetName').text(details.name);
                        $('#detailsAssetType').text(details.type || '-');
                        $('#detailsAssetLocation').text(details.location || '-');
                        const statusBadge = {"Normal": "badge-success", "In Repair": "badge-warning", "Disposed": "badge-danger"};
                        $('#detailsAssetStatus').html(`<span class="badge ${statusBadge[details.status] || 'badge-secondary'}">${details.status}</span>`);
                        const $historyBody = $('#detailsHistoryTableBody').empty();
                        if (history.length > 0) {
                            history.forEach(item => {
                                $historyBody.append(`<tr>
                                    <td>${formatDateTime(item.requestDate)}</td>
                                    <td>${item.requestUser}</td>
                                    <td>${item.problemDescription}</td>
                                    <td>${formatDateTime(item.acceptedDate)}</td>
                                    <td>${formatDateTime(item.completedDate)}</td>
                                    <td><span class="badge badge-info">${item.status}</span></td>
                                </tr>`);
                            });
                        } else {
                            $historyBody.append('<tr><td colspan="6" class="text-center">ไม่พบประวัติการซ่อม</td></tr>');
                        }
                        const $qrContainer = $('#detailsModalQrCode').empty();
                        const qrUrl = `${baseUrl}/scan-and-repair.html?asset=${assetNumber}`;
                        new QRCode($qrContainer[0], { text: qrUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.H });
                        $('#detailsModal').modal('show');
                    }
                });
            }
            if ($btn.hasClass('edit-btn')) {
                const id = $(this).data('id');
                const item = window.equipmentData.find(d => d.id == id);
                if (item) {
                    $('#equipmentId').val(item.id);
                    $('#assetNumber').val(item.assetNumber);
                    $('#name').val(item.name);
                    $('#type').val(item.type);
                    $('#location').val(item.location);
                    $('#status').val(item.status);
                    $('#modalTitle').text('แก้ไขข้อมูลครุภัณฑ์');
                    $equipmentModal.modal('show');
                }
            }
            if ($btn.hasClass('delete-btn')) {
                const id = $(this).data('id');
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?')) {
                    $.ajax({
                        url: `/api/equipment/${id}`, method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` },
                        success: function() {
                            fetchEquipment($('.pagination .active a').data('page') || 1);
                            fetchDashboardData();
                        }
                    });
                }
            }
        });

        $('#addEquipmentBtn').on('click', (e) => {
            modalTrigger = e.currentTarget;
            const form = $('#equipmentForm')[0];
            if (form) {
                form.reset();
                $('#equipmentId').val('');
                $('#modalTitle').text('เพิ่มครุภัณฑ์ใหม่');
                $equipmentModal.modal('show');
            } else {
                console.error("Could not find form with ID 'equipmentForm'.");
                alert("เกิดข้อผิดพลาด: ไม่พบฟอร์มสำหรับเพิ่มข้อมูล!");
            }
        });
        
        $('.modal').on('hidden.bs.modal', function () {
            if (modalTrigger) {
                $(modalTrigger).focus();
                modalTrigger = null;
            }
        });

        $('#equipmentForm').on('submit', function(e) {
            e.preventDefault();
            const id = $('#equipmentId').val();
            const data = {
                assetNumber: $('#assetNumber').val(), name: $('#name').val(),
                type: $('#type').val(), location: $('#location').val(), status: $('#status').val(),
            };
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/equipment/${id}` : '/api/equipment';
            $.ajax({
                url: url, method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json', data: JSON.stringify(data),
                success: function() {
                    $equipmentModal.modal('hide');
                    fetchEquipment($('.pagination .active a').data('page') || 1);
                    fetchDashboardData();
                }
            });
        });
        
        const $usersTableBody = $('#usersTableBody');
        const $userModal = $('#userModal');
        const $userForm = $('#userForm');

        const fetchUsers = () => {
            $.ajax({
                url: '/api/users', method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(users) {
                    $usersTableBody.empty();
                    users.forEach(u => {
                        const isDisabled = u.id === user.id;
                        const row = `
                            <tr>
                                <td>${u.fullName}</td>
                                <td>${u.username}</td>
                                <td>
                                    <select class="form-control form-control-sm role-selector" data-id="${u.id}" ${isDisabled ? 'disabled' : ''}>
                                        <option value="user">User</option>
                                        <option value="technician">Technician</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </td>
                                <td class="user-action-cell">
                                    <button class="btn btn-info btn-sm update-role-btn" data-id="${u.id}" ${isDisabled ? 'disabled' : ''}>อัปเดต</button>
                                    <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}" ${isDisabled ? 'disabled' : ''}><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>`;
                        const $row = $(row);
                        $row.find('.role-selector').val(u.role);
                        $usersTableBody.append($row);
                    });
                }
            });
        };

        $('#addUserBtn').on('click', function(e) {
            modalTrigger = e.currentTarget;
            $userForm[0].reset();
            $('#userModalTitle').text('เพิ่มผู้ใช้งานใหม่');
            $userModal.modal('show');
        });

        $userForm.on('submit', function(e) {
            e.preventDefault();
            const password = $('#userPassword').val();
            const confirmPassword = $('#userConfirmPassword').val();
            if (password !== confirmPassword) {
                alert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
                return;
            }
            const userData = {
                fullName: $('#userFullName').val(),
                username: $('#userUsername').val(),
                password: password,
                role: $('#userRole').val()
            };
            $.ajax({
                url: '/api/users',
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json',
                data: JSON.stringify(userData),
                success: function(response) {
                    $userModal.modal('hide');
                    alert(response.message);
                    fetchUsers();
                },
                error: function(jqXHR) {
                    alert('เกิดข้อผิดพลาด: ' + (jqXHR.responseJSON?.message || 'ไม่สามารถสร้างผู้ใช้ได้'));
                }
            });
        });


        $usersTableBody.on('click', '.update-role-btn', function() {
            const id = $(this).data('id');
            const role = $(`.role-selector[data-id="${id}"]`).val();
            if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนบทบาทเป็น '${role}'?`)) {
                 $.ajax({
                    url: `/api/users/${id}`, method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    contentType: 'application/json', data: JSON.stringify({ role }),
                    success: function() { alert('อัปเดตบทบาทสำเร็จ!'); fetchUsers(); }
                });
            }
        });

        $usersTableBody.on('click', '.delete-user-btn', function() {
            const id = $(this).data('id');
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานคนนี้?')) {
                $.ajax({
                    url: `/api/users/${id}`, method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                    success: function() { alert('ลบผู้ใช้งานสำเร็จ!'); fetchUsers(); }
                });
            }
        });
        
        $('#csvFile').on('change', function() {
            const fileName = $(this).val().split('\\').pop();
            $('#csvFileName').text(fileName || 'ยังไม่ได้เลือกไฟล์');
        });

        $('#importBtn').on('click', function() {
            const file = $('#csvFile')[0].files[0];
            const $message = $('#ioMessage');
            if (!file) { alert('กรุณาเลือกไฟล์ CSV ก่อนครับ'); return; }
            const formData = new FormData();
            formData.append('csvFile', file);
            
            $.ajax({
                url: '/api/equipment/import', method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                data: formData, processData: false, contentType: false,
                success: function(response) {
                    displayMessage($message, response.message, true);
                    $('#csvFile').val(''); $('#csvFileName').text('ยังไม่ได้เลือกไฟล์');
                    fetchEquipment();
                    fetchDashboardData();
                },
                error: function(jqXHR) {
                    displayMessage($message, jqXHR.responseJSON.message, false);
                }
            });
        });

        $('#exportBtn').on('click', function() { window.location.href = `/api/equipment/export?token=${token}`; });
        
        $('#printQrBtn').on('click', function() {
            const printArea = $('#print-area');
            if (!window.equipmentData || window.equipmentData.length === 0) {
                alert('ไม่มีข้อมูลครุภัณฑ์สำหรับพิมพ์ในหน้านี้');
                return;
            }
            printArea.empty();
            window.equipmentData.forEach(item => {
                const label = $(`<div class="qr-label"><div class="qr-code-print"></div><div class="qr-text-print">${item.assetNumber}</div></div>`);
                printArea.append(label);
                const qrUrl = `${baseUrl}/scan-and-repair.html?asset=${item.assetNumber}`;
                new QRCode(label.find('.qr-code-print')[0], { 
                    text: qrUrl, 
                    width: 160, 
                    height: 160, 
                    correctLevel: QRCode.CorrectLevel.H 
                });
            });
            setTimeout(() => { window.print(); }, 500);
        });

        // Initial Load
        fetchDashboardData();
        fetchEquipment();
        fetchUsers();
    }
});

