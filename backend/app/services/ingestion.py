import io
import re
import zlib
import zipfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple


class DocumentIngestionService:
    """
    Robust text extraction and chunking service for PDF, DOCX, and TXT files.
    Extracts text per page and chunks into ~500 tokens with ~80 token overlap
    while preserving page numbers for citation integrity.
    """

    APPROX_CHARS_PER_TOKEN = 4  # Standard ~4 characters per token
    TARGET_CHUNK_TOKENS = 500   # ~2000 chars
    OVERLAP_TOKENS = 80         # ~320 chars

    @classmethod
    def extract_text_per_page(cls, file_bytes: bytes, filename: str) -> List[Tuple[int, str]]:
        """
        Extracts a list of (page_number, page_text) tuples from the uploaded document bytes.
        """
        ext = filename.lower().split(".")[-1] if "." in filename else ""

        if ext == "txt":
            return cls._extract_from_txt(file_bytes)
        elif ext == "docx":
            return cls._extract_from_docx(file_bytes)
        elif ext == "pdf":
            pages = cls._extract_from_pdf(file_bytes)
            total_chars = sum(len(p[1].strip()) for p in pages)
            if total_chars < 20:
                raise ValueError(
                    "Unsupported scanned PDF or image-only document with no extractable text layer. "
                    "Please upload a machine-readable digital PDF or extract text using OCR first."
                )
            return pages
        else:
            # Fallback text decoding
            try:
                text = file_bytes.decode("utf-8", errors="ignore")
                return [(1, text)]
            except Exception:
                return [(1, "")]

    @classmethod
    def _extract_from_txt(cls, file_bytes: bytes) -> List[Tuple[int, str]]:
        text = file_bytes.decode("utf-8", errors="ignore")
        # Check for form feeds (\f) or page marker headers
        pages = []
        if "\f" in text:
            raw_pages = text.split("\f")
            for i, p in enumerate(raw_pages, 1):
                clean = p.strip()
                if clean:
                    pages.append((i, clean))
        else:
            # Check for page regex
            parts = re.split(r"(?:^|\n)(?:[-=]{3,}\s*Page\s*(\d+)\s*[-=]{3,})", text, flags=re.IGNORECASE)
            if len(parts) > 1:
                current_page = 1
                for idx in range(1, len(parts), 2):
                    p_num = int(parts[idx]) if parts[idx] and parts[idx].isdigit() else current_page
                    p_text = parts[idx + 1].strip() if idx + 1 < len(parts) else ""
                    if p_text:
                        pages.append((p_num, p_text))
                    current_page = p_num + 1
            else:
                # If single continuous text, partition into ~2000 char pages
                lines = text.splitlines(keepends=True)
                page_acc = []
                cur_len = 0
                page_num = 1
                for line in lines:
                    page_acc.append(line)
                    cur_len += len(line)
                    if cur_len >= 2500:
                        pages.append((page_num, "".join(page_acc).strip()))
                        page_acc = []
                        cur_len = 0
                        page_num += 1
                if page_acc:
                    pages.append((page_num, "".join(page_acc).strip()))

        return pages if pages else [(1, text.strip())]

    @classmethod
    def _extract_from_docx(cls, file_bytes: bytes) -> List[Tuple[int, str]]:
        """
        Parses standard OpenXML DOCX archive and extracts paragraphs, preserving page breaks.
        """
        pages: List[Tuple[int, str]] = []
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx_zip:
                xml_content = docx_zip.read("word/document.xml")
                root = ET.fromstring(xml_content)

                # XML namespaces
                ns = {
                    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                }

                current_page = 1
                current_text: List[str] = []

                for p in root.iter(f"{{{ns['w']}}}p"):
                    # Check for explicit page break in this paragraph
                    has_break = False
                    for br in p.iter(f"{{{ns['w']}}}br"):
                        if br.get(f"{{{ns['w']}}}type") == "page":
                            has_break = True
                            break
                    for _ in p.iter(f"{{{ns['w']}}}lastRenderedPageBreak"):
                        has_break = True
                        break

                    if has_break and current_text:
                        pages.append((current_page, "\n".join(current_text).strip()))
                        current_page += 1
                        current_text = []

                    # Extract all text runs in paragraph
                    texts = [t.text for t in p.iter(f"{{{ns['w']}}}t") if t.text]
                    if texts:
                        para_str = "".join(texts).strip()
                        if para_str:
                            current_text.append(para_str)

                if current_text:
                    pages.append((current_page, "\n".join(current_text).strip()))

        except Exception as e:
            # Fallback to UTF-8 extraction if zip read fails
            text = file_bytes.decode("utf-8", errors="ignore")
            pages = [(1, text)]

        return pages if pages else [(1, "")]

    @classmethod
    def _extract_from_pdf(cls, file_bytes: bytes) -> List[Tuple[int, str]]:
        """
        Lightweight native PDF extractor that searches for streams and text blocks (BT ... ET),
        decompressing FlateDecode streams with zlib.
        """
        pages: List[Tuple[int, str]] = []
        try:
            # Split PDF by page markers if identifiable
            # Search for /Type /Page objects
            raw = file_bytes
            page_obj_pattern = re.compile(rb"/Type\s*/Page\b")
            page_matches = list(page_obj_pattern.finditer(raw))

            # Decompress and collect text from stream objects
            stream_pattern = re.compile(rb"stream[\r\n]+(.*?)[\r\n]+endstream", re.DOTALL)
            extracted_streams = []

            for match in stream_pattern.finditer(raw):
                stream_data = match.group(1)
                # Try zlib decompression
                try:
                    decompressed = zlib.decompress(stream_data)
                    extracted_streams.append(decompressed)
                except Exception:
                    extracted_streams.append(stream_data)

            combined_text = []
            for stream in extracted_streams:
                # Look for text inside parenthesis (text) Tj or [(text)] TJ
                tj_matches = re.findall(rb"\((.*?)\)\s*Tj", stream)
                for m in tj_matches:
                    try:
                        combined_text.append(m.decode("latin1", errors="ignore"))
                    except Exception:
                        pass
                
                # Check for bracket array of strings
                array_matches = re.findall(rb"\[(.*?)\]\s*TJ", stream)
                for arr in array_matches:
                    inner_texts = re.findall(rb"\((.*?)\)", arr)
                    for m in inner_texts:
                        try:
                            combined_text.append(m.decode("latin1", errors="ignore"))
                        except Exception:
                            pass

            full_extracted = " ".join(combined_text).strip()
            if not full_extracted:
                # Fallback: extract ASCII strings, excluding internal PDF structural dictionary tokens
                pdf_structure_tokens = {
                    "type", "catalog", "pages", "kids", "page", "mediabox", "root",
                    "parent", "count", "trailer", "xref", "startxref", "obj", "endobj",
                    "stream", "endstream", "filter", "flatedecode", "length", "size",
                    "font", "subtype", "type1", "basetype", "fontdescriptor", "title"
                }
                raw_words = re.findall(r"[a-zA-Z]{3,}", raw.decode("latin1", errors="ignore"))
                meaningful_words = [w for w in raw_words if w.lower() not in pdf_structure_tokens]
                full_extracted = " ".join(meaningful_words).strip()

            # Split into reasonable pages of ~2000 characters if multiple pages found
            num_pages = max(1, len(page_matches))
            words = full_extracted.split()
            words_per_page = max(50, len(words) // num_pages) if num_pages > 0 else 250
            
            for p_idx in range(num_pages):
                start = p_idx * words_per_page
                end = start + words_per_page if p_idx < num_pages - 1 else len(words)
                page_words = words[start:end]
                if page_words:
                    pages.append((p_idx + 1, " ".join(page_words)))

        except Exception:
            pages = [(1, "")]

        return pages if pages else [(1, "")]

    @classmethod
    def chunk_document(
        cls,
        pages: List[Tuple[int, str]],
        document_id: str,
        document_title: str,
        source_label: str
    ) -> List[Dict[str, Any]]:
        """
        Chunks pages into segments of ~500 tokens with ~80 token overlap,
        preserving page numbers (page_ref) in each chunk.
        """
        chunk_char_target = cls.TARGET_CHUNK_TOKENS * cls.APPROX_CHARS_PER_TOKEN  # ~2000 chars
        overlap_chars = cls.OVERLAP_TOKENS * cls.APPROX_CHARS_PER_TOKEN           # ~320 chars

        chunks: List[Dict[str, Any]] = []
        chunk_index = 0

        for page_num, page_text in pages:
            clean_text = page_text.strip()
            if not clean_text:
                continue

            page_ref = f"Page {page_num}"

            # If page text is within target, store as single chunk
            if len(clean_text) <= chunk_char_target:
                chunks.append({
                    "id": f"{document_id}-chk-{chunk_index}",
                    "document_id": document_id,
                    "chunk_index": chunk_index,
                    "content": clean_text,
                    "page_ref": page_ref,
                    "document_title": document_title,
                    "source_label": source_label,
                })
                chunk_index += 1
                continue

            # Otherwise, split into overlapping windows along sentence or word boundaries
            start = 0
            while start < len(clean_text):
                end = start + chunk_char_target

                if end < len(clean_text):
                    # Find a clean boundary (sentence end or space)
                    boundary = clean_text.rfind(". ", start, end)
                    if boundary != -1 and boundary > start + (chunk_char_target // 2):
                        end = boundary + 1
                    else:
                        space_boundary = clean_text.rfind(" ", start, end)
                        if space_boundary != -1 and space_boundary > start + (chunk_char_target // 2):
                            end = space_boundary

                chunk_str = clean_text[start:end].strip()
                if chunk_str:
                    chunks.append({
                        "id": f"{document_id}-chk-{chunk_index}",
                        "document_id": document_id,
                        "chunk_index": chunk_index,
                        "content": chunk_str,
                        "page_ref": page_ref,
                        "document_title": document_title,
                        "source_label": source_label,
                    })
                    chunk_index += 1

                # Advance window with overlap
                start = end - overlap_chars
                if start >= len(clean_text) - 50:
                    break

        return chunks
