// src/js/ProductsManager.js
// Единый менеджер для работы с товарами

import { showToast, showLoadingIndicator, hideLoadingIndicator } from './utils.js';

// ===== API Сервис =====
class ProductAPIService {
    constructor() {
        this.baseUrl = '/api';
    }

    async search(params) {
        const url = new URL(`${this.baseUrl}/search`, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.append(key, value);
            }
        });

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error('Search error:', error);
            return {
                success: false,
                error: error.message,
                data: { products: [], total: 0 }
            };
        }
    }

    async getAvailability(productIds, cityId) {
        const url = new URL(`${this.baseUrl}/availability`, window.location.origin);
        url.searchParams.append('city_id', cityId);
        url.searchParams.append('product_ids', productIds.join(','));

        try {
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                return result.data || {};
            }
            return {};
        } catch (error) {
            console.error('Availability error:', error);
            return {};
        }
    }
}

// ===== Главный менеджер =====
export class ProductsManager {
    constructor() {
        this.api = new ProductAPIService();
        
        // Состояние
        this.products = [];
        this.currentPage = parseInt(sessionStorage.getItem('currentPage') || '1');
        this.itemsPerPage = parseInt(sessionStorage.getItem('itemsPerPage') || '20');
        this.totalProducts = 0;
        this.sortColumn = sessionStorage.getItem('sortColumn') || 'name';
        this.sortDirection = sessionStorage.getItem('sortDirection') || 'asc';
        this.appliedFilters = {};
        this.isLoading = false;

        // Восстанавливаем фильтры
        Object.keys(sessionStorage).forEach(key => {
            if (!['itemsPerPage', 'sortColumn', 'sortDirection', 'currentPage'].includes(key)) {
                this.appliedFilters[key] = sessionStorage.getItem(key);
            }
        });

        this.init();
    }

    init() {
        this.bindEvents();
        this.syncGlobalVariables();
    }

    bindEvents() {
        // Поиск
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const value = e.target.value.trim();
                
                if (value) {
                    this.appliedFilters.search = value;
                    sessionStorage.setItem('search', value);
                } else {
                    delete this.appliedFilters.search;
                    sessionStorage.removeItem('search');
                }
                
                searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.fetchProducts();
                }, 300);
            });

            // Восстанавливаем значение
            if (this.appliedFilters.search) {
                searchInput.value = this.appliedFilters.search;
            }
        }
    }

    syncGlobalVariables() {
        // Синхронизация с глобальными переменными
        window.productsData = this.products;
        window.currentPage = this.currentPage;
        window.itemsPerPage = this.itemsPerPage;
        window.totalProducts = this.totalProducts;
        window.sortColumn = this.sortColumn;
        window.sortDirection = this.sortDirection;
        window.appliedFilters = this.appliedFilters;
    }

    async fetchProducts() {
        if (this.isLoading) return;
    
        this.isLoading = true;
        showLoadingIndicator();
    
        try {
            const params = {
                q: this.appliedFilters.search || '',
                page: this.currentPage,
                limit: this.itemsPerPage,
                sort: this.convertSortToApiFormat(this.sortColumn, this.sortDirection),
                city_id: document.getElementById('citySelect')?.value || '1'
            };
    
            // Добавляем фильтры
            Object.entries(this.appliedFilters).forEach(([key, value]) => {
                if (key !== 'search' && value) {
                    params[key] = value;
                }
            });
    
            const result = await this.api.search(params);
            
            if (result.success || result.data) {
                this.products = result.data?.products || result.products || [];
                this.totalProducts = result.data?.total || result.total || 0;
                
                this.syncGlobalVariables();
                
                if (typeof window.renderProductsTable === 'function') {
                    window.renderProductsTable();
                }
                
                this.updatePaginationDisplay();
                
                // Загружаем наличие
                if (this.products.length > 0) {
                    this.loadAvailability();
                }
            } else {
                this.products = [];
                this.totalProducts = 0;
                this.syncGlobalVariables();
                
                if (window.renderProductsTable) {
                    window.renderProductsTable();
                }
                
                showToast('Ошибка загрузки товаров', true);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            this.products = [];
            this.totalProducts = 0;
            this.syncGlobalVariables();
            
            if (window.renderProductsTable) {
                window.renderProductsTable();
            }
            
            showToast('Ошибка загрузки: ' + error.message, true);
        } finally {
            this.isLoading = false;
            hideLoadingIndicator();
        }
    }

    async loadAvailability() {
        const productIds = this.products.map(p => p.product_id);
        const cityId = document.getElementById('citySelect')?.value || '1';
        
        // Используем существующую функцию loadAvailability
        if (window.loadAvailability) {
            window.loadAvailability(productIds);
        }
    }

    convertSortToApiFormat(column, direction) {
        if (column === 'base_price' || column === 'price') {
            return direction === 'asc' ? 'price_asc' : 'price_desc';
        }
        
        const sortableColumns = ['name', 'external_id', 'sku', 'availability', 'popularity'];
        if (sortableColumns.includes(column)) {
            return column;
        }
        
        return 'relevance';
    }

    updatePaginationDisplay() {
        const totalPages = Math.ceil(this.totalProducts / this.itemsPerPage);
        
        // Обновляем все элементы пагинации
        document.querySelectorAll('#currentPage, #currentPageBottom').forEach(el => {
            if (el) el.textContent = this.currentPage;
        });
        
        document.querySelectorAll('#totalPages, #totalPagesBottom').forEach(el => {
            if (el) el.textContent = totalPages;
        });
        
        document.querySelectorAll('#totalProductsText, #totalProductsTextBottom').forEach(el => {
            if (el) el.textContent = `Найдено товаров: ${this.totalProducts}`;
        });
        
        // Управление кнопками
        document.querySelectorAll('.prev-btn').forEach(btn => {
            if (btn) btn.disabled = this.currentPage <= 1;
        });
        
        document.querySelectorAll('.next-btn').forEach(btn => {
            if (btn) btn.disabled = this.currentPage >= totalPages;
        });
        
        // Вызываем глобальную функцию если она есть
        if (window.updatePaginationDisplay) {
            window.updatePaginationDisplay();
        }
    }

    sortProducts(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        sessionStorage.setItem('sortColumn', this.sortColumn);
        sessionStorage.setItem('sortDirection', this.sortDirection);
        
        this.syncGlobalVariables();
        
        this.currentPage = 1;
        this.fetchProducts();
    }

    loadPage(page) {
        this.currentPage = page;
        sessionStorage.setItem('currentPage', page);
        this.syncGlobalVariables();
        this.fetchProducts();
    }
}

// Экспорт экземпляра
export const productsManager = new ProductsManager();