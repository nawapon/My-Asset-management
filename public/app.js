// public/app.js (Complete Version with All Features)

$(document).ready(function() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    // Helper function for displaying messages
    function displayMessage(element, message, isSuccess) {
        const alertClass = isSuccess ? 'alert alert-success' : 'alert alert-danger';
        element.text(message).removeClass('alert-success alert-danger').addClass(alertClass).show();
        setTimeout(() => element.hide().text(''), 4000);
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
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/index.html';
        });

        // Sidebar Navigation
        $('.nav-sidebar .nav-link').on('click', function(e) {
            e.preventDefault();
            $('.nav-sidebar .nav-link').removeClass('active');
            $(this).addClass('active');
            const targetId = $(this).data('target');
            $('.content-section').removeClass('active');
            $(targetId).addClass('active');
        });
    }
    
    // --- User Dashboard Page Logic ---
    if ($('body.user-page').length) {
        let userCurrentSearchTerm = '';
        const $userEquipmentTableBody = $('#userEquipmentTableBody');
        const $userResetSearchBtn = $('#userResetSearchBtn');

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

        $userEquipmentTableBody.on('click', '.details-btn', function() {
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
                            $historyBody.append(`<tr><td>${new Date(item.requestDate).toLocaleDateString('th-TH')}</td><td>${item.requestUser}</td><td>${item.problemDescription}</td><td><span class="badge badge-info">${item.status}</span></td></tr>`);
                        });
                    } else {
                        $historyBody.append('<tr><td colspan="4" class="text-center">ไม่พบประวัติการซ่อม</td></tr>');
                    }
                    $('#detailsModal').modal('show');
                }
            });
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
            $.ajax({
                url: '/api/repairs', method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json',
                data: JSON.stringify({ assetNumber, problemDescription }),
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
        const $allRepairsTableBody = $('#allRepairsTableBody');
        const fetchAllRepairs = () => {
            $.ajax({
                url: '/api/repairs', method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(repairs) {
                    $allRepairsTableBody.empty();
                    repairs.forEach(r => {
                        const statusBadge = {"Pending": "badge-warning", "In Progress": "badge-primary", "Completed": "badge-success"};
                        const row = `<tr>
                            <td>${r.assetNumber}</td>
                            <td>${r.requestUser}</td>
                            <td>${r.problemDescription}</td>
                            <td>${new Date(r.requestDate).toLocaleDateString('th-TH')}</td>
                            <td><span class="badge ${statusBadge[r.status] || 'badge-secondary'}">${r.status}</span></td>
                            <td class="d-flex align-items-center">
                                <select class="form-control form-control-sm status-selector mr-2" data-id="${r.id}">
                                    <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="In Progress" ${r.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="Completed" ${r.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                </select>
                                <button class="btn btn-info btn-sm update-status-btn" data-id="${r.id}"><i class="fas fa-check"></i></button>
                            </td>
                        </tr>`;
                        $allRepairsTableBody.append(row);
                    });
                }
            });
        };
        $allRepairsTableBody.on('click', '.update-status-btn', function() {
            const repairId = $(this).data('id');
            const newStatus = $(`.status-selector[data-id="${repairId}"]`).val();
            $.ajax({
                url: `/api/repairs/${repairId}`, method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                contentType: 'application/json',
                data: JSON.stringify({ status: newStatus }),
                success: function() {
                    alert('อัปเดตสถานะสำเร็จ!');
                    fetchAllRepairs();
                },
                error: function() { alert('เกิดข้อผิดพลาดในการอัปเดต'); }
            });
        });
        fetchAllRepairs();
    }
    
    // --- Admin Dashboard Logic ---
    if ($('#equipment-view').length && $('#users-view').length) {
        let currentSearchTerm = '';
        const $equipmentTableBody = $('#equipmentTableBody');
        const $equipmentModal = $('#equipmentModal');
        const $resetSearchBtn = $('#resetSearchBtn');

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
            const limit = 5;
            const url = `/api/equipment?page=${page}&limit=${limit}&search=${encodeURIComponent(currentSearchTerm)}`;
            $.ajax({
                url: url, method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(result) {
                    window.equipmentData = result.data;
                    $equipmentTableBody.empty();
                    result.data.forEach(item => {
                        const row = `
                            <tr>
                                <td><div id="qr-container-${item.id}" class="qr-code-container"></div></td>
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
                        $equipmentTableBody.append(row);
                        if (typeof QRCode !== 'undefined') {
                            const qrUrl = `${window.location.origin}/scan-and-repair.html?asset=${item.assetNumber}`;
                            new QRCode(document.getElementById(`qr-container-${item.id}`), { text: qrUrl, width: 45, height: 45, correctLevel: QRCode.CorrectLevel.H });
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
        
        $equipmentTableBody.on('click', 'button', function() {
            const $btn = $(this);
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
                                $historyBody.append(`<tr><td>${new Date(item.requestDate).toLocaleDateString('th-TH')}</td><td>${item.requestUser}</td><td>${item.problemDescription}</td><td><span class="badge badge-info">${item.status}</span></td></tr>`);
                            });
                        } else {
                            $historyBody.append('<tr><td colspan="4" class="text-center">ไม่พบประวัติการซ่อม</td></tr>');
                        }
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
                        }
                    });
                }
            }
        });

        $('#addEquipmentBtn').on('click', () => {
            const form = $('#equipmentForm')[0];
            if (form) {
                form.reset();
            } else {
                console.error("Could not find form with ID 'equipmentForm'.");
                alert("เกิดข้อผิดพลาด: ไม่พบฟอร์มสำหรับเพิ่มข้อมูล!");
                return;
            }
            $('#equipmentId').val('');
            $('#modalTitle').text('เพิ่มครุภัณฑ์ใหม่');
            $equipmentModal.modal('show');
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
                }
            });
        });
        
        const $usersTableBody = $('#usersTableBody');
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
                                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="technician" ${u.role === 'technician' ? 'selected' : ''}>Technician</option>
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </td>
                                <td>
                                    <button class="btn btn-info btn-sm update-role-btn" data-id="${u.id}" ${isDisabled ? 'disabled' : ''}>อัปเดต</button>
                                    <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}" ${isDisabled ? 'disabled' : ''}><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>`;
                        $usersTableBody.append(row);
                    });
                }
            });
        };

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
                },
                error: function(jqXHR) {
                    displayMessage($message, jqXHR.responseJSON.message, false);
                }
            });
        });

        $('#exportBtn').on('click', function() { window.location.href = `/api/equipment/export?token=${token}`; });
        
        $('#printQrBtn').on('click', function() {
            $.ajax({
                url: `/api/equipment`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(allEquipment) {
                    const printArea = $('#print-area');
                    if (!allEquipment.data || allEquipment.data.length === 0) {
                        alert('ไม่มีข้อมูลครุภัณฑ์สำหรับพิมพ์');
                        return;
                    }
                    printArea.empty();
                    allEquipment.data.forEach(item => {
                        const label = $(`<div class="qr-label"><div class="qr-code-print"></div><div class="qr-text-print">${item.assetNumber}</div></div>`);
                        printArea.append(label);
                        const qrUrl = `${window.location.origin}/scan-and-repair.html?asset=${item.assetNumber}`;
                        new QRCode(label.find('.qr-code-print')[0], { text: qrUrl, width: 80, height: 80, correctLevel: QRCode.CorrectLevel.H });
                    });
                    setTimeout(() => { window.print(); }, 500);
                }
            });
        });

        // Initial Load
        fetchEquipment();
        fetchUsers();
    }
});

