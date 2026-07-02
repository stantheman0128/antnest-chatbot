# scraping：一次性資料前處理腳本

建站初期抓商品圖用的歷史腳本，原本散在 repo 根目錄，2026-07-02 歸檔到這裡。
注意：`.gitignore` 刻意排除 `*.py` 與 `product_image_urls.json`，所以這批檔案只存在本機、不進版控，只有這份 README 會被追蹤。
腳本內都是相對路徑（`reference/images/`、`public/images/` 等），執行時要站在 repo 根目錄：

```
python scripts/scraping/scraper.py
```

- `scraper.py`：抓商品頁與圖片
- `get_image_urls.py`：整理商品圖 URL，輸出 `product_image_urls.json`
- `dedup_images.py`、`check_duplicates.py`：MD5 去重
- `rename_images.py`、`rename_for_url.py`：改名並搬進 reference/images 與 public/images
- `build_image_md.py`：產生圖片清單 markdown
- `product_image_urls.json`：`get_image_urls.py` 的輸出快照
