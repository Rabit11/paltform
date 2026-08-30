package com.zgsf.srpm.repo;

import com.zgsf.srpm.domain.SysUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SysUserRepository extends JpaRepository<SysUser, Long> {
    Optional<SysUser> findByEmpNo(String empNo);
}
